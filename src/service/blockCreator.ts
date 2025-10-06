import { ChatOpenAI } from "@langchain/openai";
import { Drill, UserProgress, DrillBlock } from "./../types/types";
import dotenv from "dotenv";
dotenv.config();


export class BlockCreator {
    private llm: ChatOpenAI;
    
    constructor() {
        this.llm = new ChatOpenAI({
            apiKey: process.env.OPENAI_API_KEY!,
            modelName: "gpt-4o-mini",
            temperature: 0.1,
        });
    }

    async createOptimizedDrillBlock(
        relevantDrills: (Drill & { relevanceScore: number })[],
        blockTheme: string,
        userProgress: UserProgress,
        blockSize: number = 8
    ) {
        if (relevantDrills.length < 3) return null;

        // Pre-filter and sort drills
        const sortedDrills = relevantDrills
            .sort((a, b) => {
                // Prioritize by skill level match
                const skillWeight = this.getSkillWeight(a.difficulty, userProgress.skillLevel);
                const skillWeightB = this.getSkillWeight(b.difficulty, userProgress.skillLevel);
                
                if (skillWeight !== skillWeightB) return skillWeightB - skillWeight;
                
                // Then by relevance score
                return b.relevanceScore - a.relevanceScore;
            })
            .slice(0, blockSize);

        // Simple rule-based selection for speed
        const selectedDrills = this.applyProgressiveSelection(sortedDrills, blockSize);
        
        if (selectedDrills.length < 3) return null;

        // Minimal GPT call for naming and objectives only
        // const objectives = await this.generateBlockMetadata(selectedDrills, blockTheme, userProgress);
        
        const totalDuration = selectedDrills.reduce((sum, drill) => sum + (drill.duration || 10), 0);
         

        return selectedDrills;
        // return {
        //     id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        //     name: objectives.name,
        //     theme: blockTheme,
        //     description: objectives.description,
        //     drills: selectedDrills.map(drill => ({
        //         ...drill,
        //         reasoning: this.generateDrillReasoning(drill, userProgress)
        //     })),
        //     coherenceScore: this.calculateCoherence(selectedDrills),
        //     totalDuration,
        //     difficulty: this.calculateBlockDifficulty(selectedDrills),
        //     learningObjectives: objectives.objectives
        // };
    }

    private getSkillWeight(drillDifficulty?: string, userLevel?: string): number {
        const levels = { beginner: 1, intermediate: 2, advanced: 3 };
        const drillLevel = levels[drillDifficulty as keyof typeof levels] || 1;
        const userLevelNum = levels[userLevel as keyof typeof levels] || 1;
        
        // Prefer drills at user level or slightly above
        if (drillLevel === userLevelNum) return 1.0;
        if (drillLevel === userLevelNum + 1) return 0.8;
        if (drillLevel === userLevelNum - 1) return 0.6;
        return 0.3;
    }

    private applyProgressiveSelection(drills: (Drill & { relevanceScore: number })[], blockSize: number): (Drill & { relevanceScore: number })[] {
        // Ensure progressive difficulty
        const beginner = drills.filter(d => d.difficulty === 'beginner');
        const intermediate = drills.filter(d => d.difficulty === 'intermediate');
        const advanced = drills.filter(d => d.difficulty === 'advanced');
        
        const selected: (Drill & { relevanceScore: number; })[] = [];
        const targetSplit = Math.floor(blockSize / 3);
        
        selected.push(...beginner.slice(0, targetSplit));
        selected.push(...intermediate.slice(0, targetSplit));
        selected.push(...advanced.slice(0, blockSize - selected.length));
        
        // Fill remaining slots with highest relevance
        const remaining = drills.filter(d => !selected.includes(d));
        selected.push(...remaining.slice(0, blockSize - selected.length));
        
        return selected.slice(0, blockSize);
    }

    private async generateBlockMetadata(drills: any[], theme: string, userProgress: UserProgress) {
        const prompt = `Create block metadata for ${drills.length} ${theme} drills for a ${userProgress.skillLevel} user.

Drills: ${drills.map(d => d.title).join(', ')}

Respond with JSON only:
{
  "name": "Block name",
  "description": "1 sentence description", 
  "objectives": ["objective1", "objective2"]
}`;

        try {
            const response = await this.llm.invoke([{ role: "user", content: prompt }]);
            const result = JSON.parse((response as any).content);
            return result;
        } catch {
            return {
                name: `${theme.toUpperCase()} Development Block`,
                description: `Focused training on ${theme} skills`,
                objectives: [`Improve ${theme} abilities`]
            };
        }
    }

    private generateDrillReasoning(drill: Drill & { relevanceScore: number }, userProgress: UserProgress): string {
        if (userProgress.weakAreas?.some(area => drill.focus?.includes(area))) {
            return "Targets your weak areas";
        }
        if (drill.relevanceScore > 0.8) {
            return "High relevance to your profile";
        }
        return "Good skill progression match";
    }

    private calculateCoherence(drills: Drill[]): number {
        // Simple coherence based on shared focus areas
        const allFocus = drills.flatMap(d => d.focus || []);
        const uniqueFocus = [...new Set(allFocus)];
        return Math.min(allFocus.length / uniqueFocus.length / drills.length, 1);
    }

    private calculateBlockDifficulty(drills: Drill[]): 'beginner' | 'intermediate' | 'advanced' {
        const scores = { beginner: 1, intermediate: 2, advanced: 3 };
        const avg = drills.reduce((sum, d) => sum + (scores[d.difficulty || 'beginner']), 0) / drills.length;
        
        if (avg <= 1.4) return 'beginner';
        if (avg <= 2.4) return 'intermediate';
        return 'advanced';
    }
}