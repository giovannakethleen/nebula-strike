import Phaser from 'phaser';

type EnemyKind = 'basic' | 'fast' | 'tank' | 'shooter';

interface EnemyConfig {
  color: number;
  speed: number;
  hp: number;
  points: number;
  radius: number;
}

const ENEMY_CONFIG: Record<EnemyKind, EnemyConfig> = {
  basic: { color: 0xff557f, speed: 70, hp: 1, points: 100, radius: 13 },
  fast: { color: 0xffbd4a, speed: 135, hp: 1, points: 150, radius: 10 },
  tank: { color: 0xb879ff, speed: 42, hp: 3, points: 300, radius: 18 },
  shooter: { color: 0x65f5b7, speed: 55, hp: 2, points: 220, radius: 14 }
};

interface Enemy {
  body: Phaser.GameObjects.Arc;
  kind: EnemyKind;
  hp: number;
  speed: number;
  points: number;
  fireTimer: number;
  drift: number;
}

type EnemyBullet = Phaser.GameObjects.Arc & {
  speed?: number;
  remainingLifetime?: number;
};

export interface ShipConfiguration {
  bodyColor: number;
  wingColor: number;
  speed: number;
  shotDelay: number;
  bulletSpeed: number;
}

const PLAYER_SHIP: ShipConfiguration = {
  bodyColor: 0x00e5ff,
  wingColor: 0x4d72bd,
  speed: 280,
  shotDelay: 190,
  bulletSpeed: 470
};

const STARTING_LIVES = 3;
const MAX_LIVES = 5;

export class SpaceScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerShape!: Phaser.GameObjects.Triangle;
  private bullets: Phaser.GameObjects.Arc[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private lifePickups: Phaser.GameObjects.Container[] = [];
  private enemies: Enemy[] = [];
  private stars: Phaser.GameObjects.Arc[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private readonly ship = PLAYER_SHIP;
  private score = 0;
  private lives = STARTING_LIVES;
  private wave = 1;
  private spawnTimer = 0;
  private shotTimer = 0;
  private damageTimer = 0;
  private elapsed = 0;
  private ended = false;

  constructor() {
    super('SpaceScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.wave = 1;
    this.spawnTimer = 500;
    this.shotTimer = 0;
    this.damageTimer = 0;
    this.elapsed = 0;
    this.ended = false;
    this.bullets = [];
    this.enemyBullets = [];
    this.lifePickups = [];
    this.enemies = [];
    this.stars = [];

    this.add.rectangle(width / 2, height / 2, width, height, 0x080b18);
    for (let i = 0; i < 95; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(0.5, 1.8),
        i % 8 === 0 ? 0x00e5ff : 0xc5d7ff,
        Phaser.Math.FloatBetween(0.25, 0.85)
      );
      (star as Phaser.GameObjects.Arc & { speed?: number }).speed = Phaser.Math.Between(15, 75);
      this.stars.push(star);
    }

    this.playerShape = this.add.triangle(0, 0, 0, 34, 17, 0, 34, 34, this.ship.bodyColor)
      .setStrokeStyle(2, 0xc8fbff);
    const wingLeft = this.add.triangle(-10, 15, 0, 0, 0, 25, 23, 22, this.ship.wingColor);
    const wingRight = this.add.triangle(10, 15, 23, 0, 23, 22, 0, 25, this.ship.wingColor);
    const cockpit = this.add.ellipse(0, 10, 8, 14, 0xc7ffff);
    this.player = this.add.container(width / 2, height - 75, [wingLeft, wingRight, this.playerShape, cockpit]);
    this.player.setDepth(5);

    this.keys = this.input.keyboard!.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      w: 'W', a: 'A', s: 'S', d: 'D', space: 'SPACE'
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.game.events.emit('score-change', this.score);
    this.game.events.emit('wave-change', this.wave);
    this.game.events.emit('lives-change', this.lives);
  }

  override update(_time: number, delta: number): void {
    if (this.ended) return;
    const dt = Math.min(delta, 40) / 1000;
    this.elapsed += delta;
    this.stars.forEach((star) => {
      const speed = (star as Phaser.GameObjects.Arc & { speed?: number }).speed ?? 30;
      star.y += speed * dt;
      if (star.y > this.scale.height) { star.y = 0; star.x = Phaser.Math.Between(0, this.scale.width); }
    });

    this.movePlayer(dt);
    this.shotTimer -= delta;
    if (this.keys['space'].isDown && this.shotTimer <= 0) this.firePlayerBullet();
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = Math.max(850, 2100 - this.wave * 80) + Phaser.Math.Between(0, 450);
    }

    if (this.elapsed > this.wave * 16000) {
      this.wave++;
      this.game.events.emit('wave-change', this.wave);
      this.showWaveText();
    }

    this.updateBullets(dt);
    this.updateEnemies(dt, delta);
    this.updateEnemyBullets(dt);
    this.updateLifePickups(dt);
    this.checkCollisions();
  }

  private movePlayer(dt: number): void {
    const speed = this.ship.speed;
    let dx = 0, dy = 0;
    if (this.keys['left'].isDown || this.keys['a'].isDown) dx--;
    if (this.keys['right'].isDown || this.keys['d'].isDown) dx++;
    if (this.keys['up'].isDown || this.keys['w'].isDown) dy--;
    if (this.keys['down'].isDown || this.keys['s'].isDown) dy++;
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
    this.player.x += dx * speed * dt;
    if (this.player.x < -22) this.player.x = this.scale.width + 22;
    else if (this.player.x > this.scale.width + 22) this.player.x = -22;
    this.player.y = Phaser.Math.Clamp(this.player.y + dy * speed * dt, 25, this.scale.height - 25);
    if (this.damageTimer > 0) {
      this.damageTimer -= dt * 1000;
      this.player.setAlpha(Math.floor(this.damageTimer / 90) % 2 === 0 ? 0.35 : 1);
    } else this.player.setAlpha(1);
  }

  private firePlayerBullet(): void {
    this.shotTimer = this.ship.shotDelay;
    const bullet = this.add.circle(this.player.x, this.player.y - 24, 4, 0x00e5ff);
    bullet.setStrokeStyle(1, 0xd7ffff);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    this.bullets.push(bullet);
  }

  private spawnEnemy(): void {
    const choices: EnemyKind[] = this.wave < 2 ? ['basic', 'basic', 'basic', 'basic', 'fast'] :
      this.wave < 4 ? ['basic', 'basic', 'fast', 'tank', 'shooter', 'shooter'] : ['basic', 'fast', 'tank', 'shooter', 'shooter'];
    const kind = Phaser.Utils.Array.GetRandom(choices);
    const config = ENEMY_CONFIG[kind];
    const x = Phaser.Math.Between(28, this.scale.width - 28);
    const speedMultiplier = Math.min(1, 0.62 + (this.wave - 1) * 0.08);
    const body = this.add.circle(x, -25, config.radius, config.color);
    body.setStrokeStyle(2, 0xf3fbff, 0.75);
    body.setBlendMode(Phaser.BlendModes.ADD);
    this.add.circle(x, -25, Math.max(3, config.radius * 0.35), 0x10152c).setDepth(1);
    this.enemies.push({
      body, kind, hp: config.hp, speed: (config.speed + this.wave * 4) * speedMultiplier,
      points: config.points, fireTimer: Phaser.Math.Between(2400, 4200),
      drift: Phaser.Math.FloatBetween(-35, 35)
    });
  }

  private updateBullets(dt: number): void {
    this.bullets = this.bullets.filter((bullet) => {
      bullet.y -= this.ship.bulletSpeed * dt;
      if (bullet.y < -12) { bullet.destroy(); return false; }
      return true;
    });
  }

  private updateEnemies(dt: number, delta: number): void {
    this.enemies = this.enemies.filter((enemy) => {
      enemy.body.y += enemy.speed * dt;
      enemy.body.x += Math.sin(enemy.body.y / 45) * enemy.drift * dt;
      enemy.body.x = Phaser.Math.Clamp(enemy.body.x, 15, this.scale.width - 15);
      if (enemy.kind === 'shooter') {
        enemy.fireTimer -= delta;
        if (enemy.fireTimer <= 0 && enemy.body.y > 0 && enemy.body.y < this.scale.height * 0.72) {
          this.fireEnemyBullet(enemy.body.x, enemy.body.y);
          enemy.fireTimer = Math.max(1800, 3000 - this.wave * 100);
        }
      }
      if (enemy.body.y > this.scale.height + 30) {
        enemy.body.destroy();
        return false;
      }
      return true;
    });
  }

  private fireEnemyBullet(x: number, y: number): void {
    const bullet = this.add.circle(x, y + 12, 5, 0xff557f);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    const enemyBullet = bullet as EnemyBullet;
    enemyBullet.speed = 145;
    enemyBullet.remainingLifetime = 4000;
    this.enemyBullets.push(enemyBullet);
  }

  private updateEnemyBullets(dt: number): void {
    this.enemyBullets = this.enemyBullets.filter((bullet) => {
      const speed = bullet.speed ?? 145;
      bullet.remainingLifetime = (bullet.remainingLifetime ?? 4000) - dt * 1000;
      bullet.y += speed * dt;
      if (bullet.remainingLifetime <= 0 || bullet.y > this.scale.height + 10 || bullet.x < -10 || bullet.x > this.scale.width + 10) {
        bullet.destroy(); return false;
      }
      return true;
    });
  }

  private checkCollisions(): void {
    for (const bullet of [...this.bullets]) {
      const target = this.enemies.find((enemy) =>
        Phaser.Math.Distance.Between(bullet.x, bullet.y, enemy.body.x, enemy.body.y) < enemy.body.radius + 5
      );
      if (!target) continue;
      bullet.destroy();
      this.bullets = this.bullets.filter((item) => item !== bullet);
      target.hp--;
      target.body.setScale(0.85);
      this.time.delayedCall(70, () => { if (target.body.active) target.body.setScale(1); });
      if (target.hp <= 0) {
        this.score += target.points;
        this.game.events.emit('score-change', this.score);
        this.explode(target.body.x, target.body.y, target.body.fillColor);
        if (this.lives < MAX_LIVES && Phaser.Math.Between(1, 100) <= 35) {
          this.spawnLifePickup(target.body.x, target.body.y);
        }
        target.body.destroy();
        this.enemies = this.enemies.filter((enemy) => enemy !== target);
      }
    }

    if (this.damageTimer > 0) return;
    const hitEnemy = this.enemies.some((enemy) =>
      Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.body.x, enemy.body.y) < enemy.body.radius + 8
    );
    const hitBullet = this.enemyBullets.some((bullet) =>
      Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y) < 15
    );
    if (hitEnemy || hitBullet) {
      if (hitBullet) {
        const bullet = this.enemyBullets.find((item) =>
          Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) < 15
        );
        bullet?.destroy();
        this.enemyBullets = this.enemyBullets.filter((item) => item !== bullet);
      }
      this.loseLife();
    }
  }

  private loseLife(): void {
    if (this.damageTimer > 0 || this.ended) return;
    this.lives--;
    this.damageTimer = 3000;
    this.game.events.emit('lives-change', this.lives);
    this.cameras.main.shake(130, 0.006);
    if (this.lives <= 0) this.endGame();
  }

  private spawnLifePickup(x: number, y: number): void {
    const pickup = this.add.container(x, y, [
      this.add.circle(0, 0, 12, 0x153e37).setStrokeStyle(2, 0x54ffb0),
      this.add.rectangle(0, 0, 4, 14, 0x54ffb0),
      this.add.rectangle(0, 0, 14, 4, 0x54ffb0)
    ]).setDepth(4);
    this.tweens.add({ targets: pickup, alpha: 0.55, yoyo: true, repeat: -1, duration: 350 });
    this.lifePickups.push(pickup);
  }

  private updateLifePickups(dt: number): void {
    this.lifePickups = this.lifePickups.filter((pickup) => {
      pickup.y += 90 * dt;
      if (pickup.y >= this.player.y - 24) {
        pickup.destroy();
        if (this.lives >= MAX_LIVES) return false;
        this.lives++;
        this.game.events.emit('lives-change', this.lives);
        const text = this.add.text(this.player.x, this.player.y - 30, '+1 VIDA AUTOMÁTICA', {
          fontFamily: 'Orbitron, sans-serif', fontSize: '14px', color: '#54ffb0',
          stroke: '#080b18', strokeThickness: 4
        }).setOrigin(0.5).setDepth(10);
        this.tweens.add({ targets: text, y: text.y - 28, alpha: 0, duration: 900, onComplete: () => text.destroy() });
        return false;
      }
      return true;
    });
  }

  private explode(x: number, y: number, color: number): void {
    for (let i = 0; i < 7; i++) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 4), color);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-35, 35),
        y: y + Phaser.Math.Between(-35, 35),
        alpha: 0,
        scale: 0.1,
        duration: Phaser.Math.Between(220, 420),
        onComplete: () => particle.destroy()
      });
    }
  }

  private showWaveText(): void {
    const text = this.add.text(this.scale.width / 2, this.scale.height / 2, `ONDA ${this.wave}`, {
      fontFamily: 'Orbitron, sans-serif', fontSize: '28px', color: '#00e5ff',
      stroke: '#080b18', strokeThickness: 5
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: text, alpha: 0, duration: 1400, onComplete: () => text.destroy() });
  }

  private endGame(): void {
    this.ended = true;
    this.player.setAlpha(0.25);
    this.game.events.emit('game-over', this.score);
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'MISSÃO ENCERRADA', {
      fontFamily: 'Orbitron, sans-serif', fontSize: '22px', color: '#ff6584',
      stroke: '#080b18', strokeThickness: 4
    }).setOrigin(0.5).setDepth(15);
  }

  private cleanup(): void {
    this.bullets.forEach((item) => item.destroy());
    this.enemyBullets.forEach((item) => item.destroy());
    this.lifePickups.forEach((item) => item.destroy());
    this.enemies.forEach((item) => item.body.destroy());
    this.stars.forEach((item) => item.destroy());
  }
}