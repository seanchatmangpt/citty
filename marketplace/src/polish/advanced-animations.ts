/**
 * Advanced Animation System - Production Polish Feature
 * Provides sophisticated micro-interactions and loading animations
 */

import { ref, reactive, computed, nextTick } from 'vue';

export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
  iterations?: number;
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
}

export interface LoadingAnimation {
  type: 'spinner' | 'pulse' | 'skeleton' | 'shimmer' | 'wave' | 'bounce';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  speed?: 'slow' | 'normal' | 'fast';
}

export interface MicroInteraction {
  trigger: 'hover' | 'click' | 'focus' | 'scroll' | 'visible';
  animation: 'scale' | 'fade' | 'slide' | 'bounce' | 'rotate' | 'glow' | 'shake';
  config: AnimationConfig;
}

export class AdvancedAnimationSystem {
  private animationQueue: Map<string, Animation> = new Map();
  private observers: Map<string, IntersectionObserver> = new Map();
  private prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    // Listen for reduced motion preference changes
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
    });
  }

  /**
   * Create sophisticated loading animation
   */
  createLoadingAnimation(element: HTMLElement, config: LoadingAnimation): void {
    if (this.prefersReducedMotion) return;

    const animations: Record<string, Keyframe[]> = {
      spinner: [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(360deg)' }
      ],
      pulse: [
        { opacity: '1', transform: 'scale(1)' },
        { opacity: '0.5', transform: 'scale(0.95)' },
        { opacity: '1', transform: 'scale(1)' }
      ],
      skeleton: [
        { backgroundPosition: '-200px 0' },
        { backgroundPosition: 'calc(200px + 100%) 0' }
      ],
      shimmer: [
        { transform: 'translateX(-100%)' },
        { transform: 'translateX(100%)' }
      ],
      wave: [
        { transform: 'translateY(0px)' },
        { transform: 'translateY(-10px)' },
        { transform: 'translateY(0px)' }
      ],
      bounce: [
        { transform: 'translateY(0px)' },
        { transform: 'translateY(-20px)' },
        { transform: 'translateY(0px)' }
      ]
    };

    const durations: Record<string, number> = {
      slow: 2000,
      normal: 1000,
      fast: 500
    };

    const duration = durations[config.speed || 'normal'];
    const keyframes = animations[config.type];

    if (keyframes) {
      const animation = element.animate(keyframes, {
        duration,
        iterations: Infinity,
        easing: 'ease-in-out'
      });

      this.animationQueue.set(`loading-${element.id || Date.now()}`, animation);
    }
  }

  /**
   * Create micro-interaction animations
   */
  createMicroInteraction(element: HTMLElement, interaction: MicroInteraction): void {
    if (this.prefersReducedMotion) return;

    const animations: Record<string, Keyframe[]> = {
      scale: [
        { transform: 'scale(1)' },
        { transform: 'scale(1.05)' },
        { transform: 'scale(1)' }
      ],
      fade: [
        { opacity: '1' },
        { opacity: '0.8' },
        { opacity: '1' }
      ],
      slide: [
        { transform: 'translateX(0px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0px)' }
      ],
      bounce: [
        { transform: 'translateY(0px)' },
        { transform: 'translateY(-3px)' },
        { transform: 'translateY(0px)' }
      ],
      rotate: [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(5deg)' },
        { transform: 'rotate(0deg)' }
      ],
      glow: [
        { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
        { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
        { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' }
      ],
      shake: [
        { transform: 'translateX(0px)' },
        { transform: 'translateX(-2px)' },
        { transform: 'translateX(2px)' },
        { transform: 'translateX(0px)' }
      ]
    };

    const keyframes = animations[interaction.animation];
    if (!keyframes) return;

    const triggerAnimation = () => {
      const animation = element.animate(keyframes, {
        duration: interaction.config.duration,
        easing: interaction.config.easing,
        delay: interaction.config.delay || 0,
        iterations: interaction.config.iterations || 1,
        direction: interaction.config.direction || 'normal',
        fill: interaction.config.fillMode || 'both'
      });

      this.animationQueue.set(`micro-${element.id || Date.now()}`, animation);
    };

    // Add event listeners based on trigger type
    switch (interaction.trigger) {
      case 'hover':
        element.addEventListener('mouseenter', triggerAnimation);
        break;
      case 'click':
        element.addEventListener('click', triggerAnimation);
        break;
      case 'focus':
        element.addEventListener('focus', triggerAnimation);
        break;
      case 'scroll':
        window.addEventListener('scroll', triggerAnimation, { passive: true });
        break;
      case 'visible':
        this.createVisibilityObserver(element, triggerAnimation);
        break;
    }
  }

  /**
   * Create smooth transitions between states
   */
  createStateTransition(
    element: HTMLElement,
    fromState: Record<string, string>,
    toState: Record<string, string>,
    config: AnimationConfig
  ): Promise<void> {
    if (this.prefersReducedMotion) {
      Object.assign(element.style, toState);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const animation = element.animate(
        [fromState, toState],
        {
          duration: config.duration,
          easing: config.easing,
          fill: config.fillMode || 'forwards'
        }
      );

      animation.addEventListener('finish', () => {
        Object.assign(element.style, toState);
        resolve();
      });

      this.animationQueue.set(`transition-${element.id || Date.now()}`, animation);
    });
  }

  /**
   * Create staggered animations for lists
   */
  createStaggeredAnimation(
    elements: HTMLElement[],
    animation: MicroInteraction['animation'],
    staggerDelay: number = 100
  ): void {
    if (this.prefersReducedMotion) return;

    elements.forEach((element, index) => {
      setTimeout(() => {
        this.createMicroInteraction(element, {
          trigger: 'visible',
          animation,
          config: {
            duration: 600,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
          }
        });
      }, index * staggerDelay);
    });
  }

  /**
   * Create visibility observer for scroll-triggered animations
   */
  private createVisibilityObserver(element: HTMLElement, callback: () => void): void {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callback();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    this.observers.set(element.id || Date.now().toString(), observer);
  }

  /**
   * Stop all animations for an element
   */
  stopAnimations(elementId: string): void {
    this.animationQueue.forEach((animation, key) => {
      if (key.includes(elementId)) {
        animation.cancel();
        this.animationQueue.delete(key);
      }
    });
  }

  /**
   * Stop all animations
   */
  stopAllAnimations(): void {
    this.animationQueue.forEach(animation => animation.cancel());
    this.animationQueue.clear();
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  /**
   * Get animation performance metrics
   */
  getPerformanceMetrics(): {
    activeAnimations: number;
    observers: number;
    reducedMotion: boolean;
  } {
    return {
      activeAnimations: this.animationQueue.size,
      observers: this.observers.size,
      reducedMotion: this.prefersReducedMotion
    };
  }
}

/**
 * Composable for Vue 3 integration
 */
export function useAdvancedAnimations() {
  const animationSystem = reactive(new AdvancedAnimationSystem());
  const isAnimating = ref(false);

  const animate = async (
    element: HTMLElement,
    type: 'loading' | 'micro' | 'transition',
    config: LoadingAnimation | MicroInteraction | any
  ) => {
    isAnimating.value = true;
    
    try {
      switch (type) {
        case 'loading':
          animationSystem.createLoadingAnimation(element, config as LoadingAnimation);
          break;
        case 'micro':
          animationSystem.createMicroInteraction(element, config as MicroInteraction);
          break;
        case 'transition':
          await animationSystem.createStateTransition(
            element,
            config.from,
            config.to,
            config.config
          );
          break;
      }
    } finally {
      isAnimating.value = false;
    }
  };

  const stagger = (elements: HTMLElement[], animation: MicroInteraction['animation']) => {
    animationSystem.createStaggeredAnimation(elements, animation);
  };

  const stop = (elementId?: string) => {
    if (elementId) {
      animationSystem.stopAnimations(elementId);
    } else {
      animationSystem.stopAllAnimations();
    }
  };

  const metrics = computed(() => animationSystem.getPerformanceMetrics());

  return {
    animate,
    stagger,
    stop,
    isAnimating: readonly(isAnimating),
    metrics
  };
}