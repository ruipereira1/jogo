/**
 * Sistema de Temas do ArteRápida
 * Suporte a múltiplos temas e modo escuro/claro
 */

export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    canvas: string;
    canvasBorder: string;
  };
  gradients: {
    primary: string;
    secondary: string;
    hero: string;
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
  };
}

export const lightTheme: Theme = {
  id: 'light',
  name: 'Claro',
  colors: {
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    accent: '#F59E0B',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#1F2937',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    canvas: '#FFFFFF',
    canvasBorder: '#D1D5DB'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    secondary: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    hero: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #F59E0B 100%)'
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
    large: '0 10px 15px rgba(0, 0, 0, 0.1)'
  }
};

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Escuro',
  colors: {
    primary: '#60A5FA',
    secondary: '#A78BFA',
    accent: '#FBBF24',
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: '#374151',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    canvas: '#1F2937',
    canvasBorder: '#4B5563'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)',
    secondary: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
    hero: 'linear-gradient(135deg, #1F2937 0%, #111827 50%, #0F172A 100%)'
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.3)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.3)',
    large: '0 10px 15px rgba(0, 0, 0, 0.3)'
  }
};

export const oceanTheme: Theme = {
  id: 'ocean',
  name: 'Oceano',
  colors: {
    primary: '#0EA5E9',
    secondary: '#06B6D4',
    accent: '#14B8A6',
    background: '#F0F9FF',
    surface: '#E0F7FA',
    text: '#0F172A',
    textSecondary: '#475569',
    border: '#B3E5FC',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    canvas: '#FFFFFF',
    canvasBorder: '#06B6D4'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%)',
    secondary: 'linear-gradient(135deg, #06B6D4 0%, #14B8A6 100%)',
    hero: 'linear-gradient(135deg, #0EA5E9 0%, #06B6D4 50%, #14B8A6 100%)'
  },
  shadows: {
    small: '0 1px 3px rgba(14, 165, 233, 0.2)',
    medium: '0 4px 6px rgba(14, 165, 233, 0.2)',
    large: '0 10px 15px rgba(14, 165, 233, 0.2)'
  }
};

export const sunsetTheme: Theme = {
  id: 'sunset',
  name: 'Pôr do Sol',
  colors: {
    primary: '#F59E0B',
    secondary: '#EF4444',
    accent: '#EC4899',
    background: '#FEF3C7',
    surface: '#FEF7CD',
    text: '#92400E',
    textSecondary: '#B45309',
    border: '#FDE68A',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    canvas: '#FFFFFF',
    canvasBorder: '#F59E0B'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    secondary: 'linear-gradient(135deg, #EF4444 0%, #EC4899 100%)',
    hero: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #EC4899 100%)'
  },
  shadows: {
    small: '0 1px 3px rgba(245, 158, 11, 0.2)',
    medium: '0 4px 6px rgba(245, 158, 11, 0.2)',
    large: '0 10px 15px rgba(245, 158, 11, 0.2)'
  }
};

export const forestTheme: Theme = {
  id: 'forest',
  name: 'Floresta',
  colors: {
    primary: '#10B981',
    secondary: '#059669',
    accent: '#84CC16',
    background: '#F0FDF4',
    surface: '#ECFDF5',
    text: '#064E3B',
    textSecondary: '#047857',
    border: '#BBF7D0',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    canvas: '#FFFFFF',
    canvasBorder: '#10B981'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    secondary: 'linear-gradient(135deg, #059669 0%, #84CC16 100%)',
    hero: 'linear-gradient(135deg, #10B981 0%, #059669 50%, #84CC16 100%)'
  },
  shadows: {
    small: '0 1px 3px rgba(16, 185, 129, 0.2)',
    medium: '0 4px 6px rgba(16, 185, 129, 0.2)',
    large: '0 10px 15px rgba(16, 185, 129, 0.2)'
  }
};

export const availableThemes = [lightTheme, darkTheme, oceanTheme, sunsetTheme, forestTheme];

export class ThemeManager {
  private currentTheme: Theme = lightTheme;
  private listeners: ((theme: Theme) => void)[] = [];

  constructor() {
    this.loadSavedTheme();
    this.detectSystemTheme();
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  setTheme(themeId: string): void {
    const theme = availableThemes.find(t => t.id === themeId);
    if (theme) {
      this.currentTheme = theme;
      this.saveTheme(themeId);
      this.applyTheme(theme);
      this.notifyListeners(theme);
    }
  }

  toggleDarkMode(): void {
    const isDark = this.currentTheme.id === 'dark';
    this.setTheme(isDark ? 'light' : 'dark');
  }

  addThemeChangeListener(callback: (theme: Theme) => void): void {
    this.listeners.push(callback);
  }

  removeThemeChangeListener(callback: (theme: Theme) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private loadSavedTheme(): void {
    const savedThemeId = localStorage.getItem('arterapida-theme');
    if (savedThemeId) {
      const theme = availableThemes.find(t => t.id === savedThemeId);
      if (theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
      }
    }
  }

  private saveTheme(themeId: string): void {
    localStorage.setItem('arterapida-theme', themeId);
  }

  private detectSystemTheme(): void {
    if (!localStorage.getItem('arterapida-theme')) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light');
    }

    // Escutar mudanças no tema do sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('arterapida-theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;
    
    // Aplicar variáveis CSS
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    Object.entries(theme.gradients).forEach(([key, value]) => {
      root.style.setProperty(`--gradient-${key}`, value);
    });

    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    // Adicionar classe do tema ao body
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${theme.id}`);
  }

  private notifyListeners(theme: Theme): void {
    this.listeners.forEach(listener => listener(theme));
  }
}

export const themeManager = new ThemeManager(); 