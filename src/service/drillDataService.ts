import { Drill, UserProgress } from "./../types/types";

export class DrillDataService {
    
    async getAvailableDrills(
        userProgress: UserProgress,
        categories?: string[],
        maxResults: number = 50
    ): Promise<Drill[]> {
        // This would be a database query in production
        // SELECT * FROM drill_records 
        // WHERE id NOT IN (user_completed_drills)
        // AND (category IN categories OR categories IS NULL)
        // AND (prerequisites_met = true)
        // LIMIT maxResults
        
        // Simulated database query result
        const mockDrills: Drill[] = []; // Your DB query results here
        
        return mockDrills.filter(drill => {
            // Skip completed drills
            if (userProgress.completedDrillIds.includes(drill.id)) {
                return false;
            }
            
            // Check prerequisites
            if (drill.prerequisites && drill.prerequisites.length > 0) {
                return drill.prerequisites.every(prereq => 
                    userProgress.completedDrillIds.includes(prereq)
                );
            }
            
            // Filter by categories if specified
            if (categories && categories.length > 0) {
                return categories.includes(drill.category || "general");
            }
            
            return true;
        }).slice(0, maxResults);
    }

    // Deduplication method - keeps drill with highest relevance score per title
    deduplicateByTitle(drills: (Drill & { relevanceScore: number })[]): (Drill & { relevanceScore: number })[] {
        const titleMap = new Map<string, Drill & { relevanceScore: number }>();
        let duplicatesRemoved = 0;
        
        drills.forEach(drill => {
            const normalizedTitle = drill.title.toLowerCase().trim();
            const existing = titleMap.get(normalizedTitle);
            
            if (!existing || drill.relevanceScore > existing.relevanceScore) {
                if (existing) {
                    duplicatesRemoved++;
                    console.log(`Duplicate removed: "${drill.title}" (kept higher score: ${drill.relevanceScore.toFixed(3)} vs ${existing.relevanceScore.toFixed(3)})`);
                }
                titleMap.set(normalizedTitle, drill);
            } else {
                duplicatesRemoved++;
                console.log(`Duplicate removed: "${drill.title}" (lower score: ${drill.relevanceScore.toFixed(3)})`);
            }
        });
        
        if (duplicatesRemoved > 0) {
            console.log(`Deduplication: ${drills.length} → ${titleMap.size} drills (removed ${duplicatesRemoved} duplicates)`);
        }
        
        return Array.from(titleMap.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    inferCategories(userProgress: UserProgress): string[] {
        // Infer categories from user data
        if (userProgress.preferences) return userProgress.preferences;
        if (userProgress.recentActivity) return userProgress.recentActivity.slice(0, 3);
        return ['general']; // fallback
    }
}