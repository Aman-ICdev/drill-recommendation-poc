export interface Drill {
    id: string;
    title: string;
    name: string;
    description: string;
    reps: string;
    category?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    focus?: string[];
    prerequisites?: string[];
    duration?: number;
    tags?: string[];
}

export interface UserProgress {
    userId: string;
    completedDrillIds: string[];
    skillLevel?: 'beginner' | 'intermediate' | 'advanced';
    preferences?: string[];
    weakAreas?: string[];
    recentActivity?: string[]; // Last 10 drill categories
}

export interface DrillBlock {
    id: string;
    name: string;
    theme: string;
    description: string;
    drills: (Drill & { relevanceScore: number; reasoning?: string })[];
    coherenceScore: number;
    totalDuration: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    learningObjectives: string[];
}

export interface CreateDrillBlocksOptions {
    numBlocks?: number;
    blockSize?: number;
    categories?: string[];
    skillLevel?: 'beginner' | 'intermediate' | 'advanced';
}