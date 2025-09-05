/**
 * Command suggestion system for typos and similar commands
 */
export class CommandSuggester {
  /**
   * Suggest similar commands using Levenshtein distance
   */
  suggestCommands(input: string, availableCommands: string[], threshold: number = 3): string[] {
    const suggestions = availableCommands
      .map(cmd => ({
        command: cmd,
        distance: this.levenshteinDistance(input.toLowerCase(), cmd.toLowerCase())
      }))
      .filter(({ distance }) => distance <= threshold)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map(({ command }) => command);

    return suggestions;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Calculate distances
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Suggest based on partial matches
   */
  suggestPartialMatches(input: string, availableCommands: string[]): string[] {
    const inputLower = input.toLowerCase();
    
    // Exact prefix matches first
    const prefixMatches = availableCommands
      .filter(cmd => cmd.toLowerCase().startsWith(inputLower))
      .slice(0, 3);
    
    // Contains matches
    const containsMatches = availableCommands
      .filter(cmd => 
        cmd.toLowerCase().includes(inputLower) && 
        !prefixMatches.includes(cmd)
      )
      .slice(0, 2);
    
    return [...prefixMatches, ...containsMatches];
  }

  /**
   * Suggest based on common typos and abbreviations
   */
  suggestFromTypos(input: string, availableCommands: string[]): string[] {
    const commonTypos: Record<string, string[]> = {
      'comp': ['component'],
      'gen': ['generate', 'generator'],
      'val': ['validate'],
      'int': ['init', 'interactive'],
      'lst': ['list'],
      'hlp': ['help'],
      'ver': ['version', 'verbose']
    };

    const inputLower = input.toLowerCase();
    const suggestions: string[] = [];

    // Check if input matches common abbreviations
    if (commonTypos[inputLower]) {
      const expandedTerms = commonTypos[inputLower];
      expandedTerms.forEach(term => {
        const matches = availableCommands.filter(cmd => 
          cmd.toLowerCase().includes(term)
        );
        suggestions.push(...matches);
      });
    }

    return [...new Set(suggestions)].slice(0, 3);
  }

  /**
   * Get comprehensive suggestions combining multiple strategies
   */
  getComprehensiveSuggestions(input: string, availableCommands: string[]): string[] {
    const allSuggestions = [
      ...this.suggestPartialMatches(input, availableCommands),
      ...this.suggestFromTypos(input, availableCommands),
      ...this.suggestCommands(input, availableCommands)
    ];

    // Remove duplicates and return top 5
    return [...new Set(allSuggestions)].slice(0, 5);
  }
}