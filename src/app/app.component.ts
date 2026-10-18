import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import Phaser from 'phaser';
import { SpaceScene } from './game/space.scene';

type Screen = 'home' | 'game' | 'ranking';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  @ViewChild('gameHost') gameHost?: ElementRef<HTMLDivElement>;

  screen: Screen = 'home';
  game?: Phaser.Game;
  bestScore = Number(localStorage.getItem('nebula-best-score') ?? 0);
  isLightTheme = localStorage.getItem('nebula-theme') !== 'dark';
  soundVolume = this.readSoundVolume();
  soundEnabled = true;
  currentScore = 0;
  currentWave = 1;
  currentLives = 3;
  gamePaused = false;
  gameEnded = false;
  readonly maxLives = 5;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}

  startGame(): void {
    this.screen = 'game';
    this.gamePaused = false;
    this.gameEnded = false;
    this.currentScore = 0;
    this.currentWave = 1;
    this.currentLives = 3;

    // Aguarda o Angular inserir o elemento #gameHost no DOM.
    setTimeout(() => this.createGame(), 0);
  }

  private createGame(): void {
    this.destroyGame();
    const host = this.gameHost?.nativeElement;
    if (!host) return;

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: 800,
      height: 600,
      backgroundColor: '#080b18',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600
      },
      physics: { default: 'arcade', arcade: { debug: false } },
      scene: [SpaceScene],
      render: { antialias: true, pixelArt: false },
      callbacks: {
        preBoot: (game) => {
          game.sound.volume = this.soundVolume;
          game.sound.mute = !this.soundEnabled || this.soundVolume === 0;
          this.attachGameEventHandlers(game);
        }
      }
    });
  }

  private attachGameEventHandlers(game: Phaser.Game): void {
    game.events.on('score-change', (score: number) => {
      this.refreshView(() => { this.currentScore = score; });
    });
    game.events.on('wave-change', (wave: number) => {
      this.refreshView(() => { this.currentWave = wave; });
    });
    game.events.on('lives-change', (lives: number) => {
      this.refreshView(() => { this.currentLives = lives; });
    });
    game.events.on('pause-change', (paused: boolean) => {
      this.refreshView(() => { this.gamePaused = paused; });
    });
    game.events.on('game-over', (score: number) => {
      this.refreshView(() => {
        this.gamePaused = false;
        this.gameEnded = true;
        if (score > this.bestScore) {
          this.bestScore = score;
          localStorage.setItem('nebula-best-score', String(score));
        }
      });
    });
  }

  private refreshView(update: () => void): void {
    update();
    this.changeDetector.detectChanges();
  }

  backToMenu(): void {
    this.destroyGame();
    this.screen = 'home';
  }

  pauseGame(): void {
    const scene = this.game?.scene.getScene('SpaceScene');
    if (!scene || this.gameEnded) return;
    const shouldPause = !scene.scene.isPaused();
    if (shouldPause) scene.scene.pause();
    else scene.scene.resume();
    this.gamePaused = shouldPause;
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.repeat || this.screen !== 'game' || !this.game || this.gameEnded) return;
    event.preventDefault();
    this.pauseGame();
  }

  restartGame(): void {
    this.startGame();
  }

  showScreen(screen: Screen): void {
    this.destroyGame();
    this.screen = screen;
  }

  toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
    if (this.game) this.game.sound.mute = !this.soundEnabled || this.soundVolume === 0;
  }

  setSoundVolume(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    const volume = event.target.valueAsNumber;
    if (!Number.isFinite(volume)) return;

    this.soundVolume = Math.min(1, Math.max(0, volume));
    localStorage.setItem('nebula-volume', String(this.soundVolume));
    if (this.soundVolume > 0) this.soundEnabled = true;
    if (this.game) {
      this.game.sound.volume = this.soundVolume;
      this.game.sound.mute = !this.soundEnabled || this.soundVolume === 0;
    }
  }

  get isSoundActive(): boolean {
    return this.soundEnabled && this.soundVolume > 0;
  }

  toggleTheme(): void {
    this.isLightTheme = !this.isLightTheme;
    localStorage.setItem('nebula-theme', this.isLightTheme ? 'light' : 'dark');
  }

  private destroyGame(): void {
    this.game?.destroy(true);
    this.game = undefined;
    this.gamePaused = false;
  }

  private readSoundVolume(): number {
    const savedVolume = localStorage.getItem('nebula-volume');
    if (savedVolume === null) return 0.65;
    const volume = Number(savedVolume);
    return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.65;
  }

  ngOnDestroy(): void {
    this.destroyGame();
  }
}