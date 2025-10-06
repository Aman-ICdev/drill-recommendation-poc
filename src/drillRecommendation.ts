
import { VectorStoreManager } from "./service/vectorStoreManager.ts";
import { DrillDataService } from "./service/drillDataService.ts";
import { BlockCreator } from "./service/blockCreator.ts";
import { Drill, UserProgress, DrillBlock } from "./types/types.ts";

export class ScalableDrillRecommendationSystem {
    private vectorStoreManager: VectorStoreManager;
    private drillDataService: DrillDataService;
    private blockCreator: BlockCreator;
    
    constructor() {
        this.vectorStoreManager = new VectorStoreManager();
        this.drillDataService = new DrillDataService();
        this.blockCreator = new BlockCreator();
    }

    // Initialize vector store (do this once, store embeddings persistently)
    async initializeVectorStore(indexName: string = "drills-idx") {
        return await this.vectorStoreManager.initializeVectorStore(indexName);
    }

    // Batch process and store drill embeddings (run offline/scheduled)
    async batchProcessDrills(drills: Drill[], batchSize: number = 100): Promise<void> {
        await this.vectorStoreManager.batchProcessDrills(drills, batchSize);
    }

    // Efficient drill filtering with database queries
    async getAvailableDrills(
        userProgress: UserProgress,
        categories?: string[],
        maxResults: number = 50
    ): Promise<Drill[]> {
        return await this.drillDataService.getAvailableDrills(userProgress, categories, maxResults);
    }

    // Smart semantic search with filters and deduplication
    async findRelevantDrills(
        userProfile: string,
        userProgress: UserProgress,
        topK: number = 30,
        skillLevel?: string,
        equipment?: string[],
    ): Promise<(Drill & { relevanceScore: number })[]> {
        const relevantDrills = await this.vectorStoreManager.findRelevantDrills(
            userProfile, 
            userProgress, 
            topK,
            skillLevel,
            equipment
        );

        // Deduplicate by title and return original topK count
        const uniqueDrills = this.drillDataService.deduplicateByTitle(relevantDrills);
        return uniqueDrills.slice(0, topK);
    }

    // Lightweight block creation (fewer GPT calls)
    async createOptimizedDrillBlock(
        relevantDrills: (Drill & { relevanceScore: number })[],
        blockTheme: string,
        userProgress: UserProgress,
        blockSize: number = 8
    ): Promise<Drill[] | null> {
        return await this.blockCreator.createOptimizedDrillBlock(
            relevantDrills,
            blockTheme,
            userProgress,
            blockSize
        );
    }

    // Main public method - optimized for 15k+ drills
    async createPersonalizedDrillBlocks(
        userProfile: string,
        userProgress: UserProgress,
        skillLevel: string,
        equipment: string[],
        numBlocks: number = 3,
        blockSize: number = 8,
    ) {
        console.log(`Creating ${numBlocks} blocks for user with ${userProgress.completedDrillIds.length} completed drills`);
        
        if (!this.vectorStoreManager.getVectorStore()) {
            await this.initializeVectorStore();
        }

        const relevantDrills = await this.findRelevantDrills(
            userProfile, 
            userProgress, 
            numBlocks * blockSize * 20,
            skillLevel,
            equipment
        );

        console.log(`Found ${relevantDrills.length} relevant drills`);

        if (relevantDrills.length === 0) {
            throw new Error("No available drills found");
        }

        const focusGroups = new Map<string, typeof relevantDrills>();
        relevantDrills.forEach(drill => {
            drill.focus?.forEach(focus => {
                if (!focusGroups.has(focus)) focusGroups.set(focus, []);
                focusGroups.get(focus)!.push(drill);
            });
        });

        const blocks: DrillBlock[] = [];
        const usedDrillIds = new Set<string>();

        // Create blocks efficiently
        // for (const [focus, drillsInFocus] of Array.from(focusGroups.entries()).slice(0, numBlocks)) {
        //     const availableDrills = drillsInFocus.filter(d => !usedDrillIds.has(d.id));
            
        //     if (availableDrills.length >= 3) {
        //         const block = await this.createOptimizedDrillBlock(
        //             availableDrills, 
        //             focus, 
        //             userProgress, 
        //             blockSize
        //         );
                
        //         if (block) {
        //             blocks.push(block);
        //             block.drills.forEach(d => usedDrillIds.add(d.id));
        //         }
        //     }
        // }

        const block = await this.createOptimizedDrillBlock(
            relevantDrills, 
            "Hitting", 
            userProgress, 
            blockSize
        );

        console.log(`Created block: `, block);
        
        // fs.writeFileSync(path.join(process.cwd(), 'data/generated-block.json'), JSON.stringify(block, null, 2));

        console.log(`Created ${blocks.length} personalized drill blocks`);
        if (!block) {
            throw new Error("Failed to create any drill blocks");
        }
        return block;
    }
}


const userProfile = `
    User is an intermediate level athlete focusing on baseball hitting skills.
    Drills they Liked: Rolling Stride Tee Drill, One Knee Drill
    Drills they Disliked: Heavy Bat Swing, Long Toss
    Recent Activity: Tee Work, Soft Toss, Batting Practice
`;


const drillsCompleted = ['696d7582-de58-47e1-8084-5b96cacaa9fa'];
const user = 'user1';

