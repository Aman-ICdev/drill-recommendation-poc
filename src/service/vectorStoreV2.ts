import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
dotenv.config();

// Updated type to match your JSON structure
interface DrillData {
    "Drill Name": string;
    "Description": string;
    "Reps": string;
    "Content Type": string;
    "Skill Level": string;
    "Skills": string;
    "Equipment": string;
    "Rank": string | number;
    "Drill ID": string;
}

// Transform function to convert JSON format to vector store format
function transformDrillData(drillData: DrillData[]): Array<{text: string, metadata: any}> {
    return drillData.map(drill => {
        // Parse comma-separated fields
        const skillLevels = drill["Skill Level"].split(',').map(s => s.trim());
        const skills = drill["Skills"].split(',').map(s => s.trim());
        const equipment = drill["Equipment"].split(',').map(e => e.trim());
        
        // Determine difficulty from skill level
        const difficulty = skillLevels.includes("Youth") ? "beginner" 
                         : skillLevels.includes("College") ? "advanced" 
                         : "intermediate";
        
        // Create rich text for embedding
        const text = `
            ${drill["Drill Name"]}
            ${drill["Description"]}
            Skills: ${skills.join(' ')}
            Skill Level: ${drill["Skill Level"]}
            Equipment: ${drill["Equipment"]}
            Content Type: ${drill["Content Type"]}
        `.trim();
        
        // Create metadata
        const metadata = {
            id: drill["Drill ID"],
            title: drill["Drill Name"],
            description: drill["Description"],
            reps: drill["Reps"],
            category: drill["Content Type"], // "Drill" or "Introduction Video"
            difficulty: difficulty,
            focus: skills, // The skills this drill focuses on
            skillLevels: skillLevels,
            equipment: equipment,
            duration: estimateDuration(drill["Reps"]), // Estimate from reps
            rank: drill["Rank"],
            prerequisites: [] // Add if needed
        };
        
        return { text, metadata };
    });
}

// Helper to estimate duration from reps
function estimateDuration(reps: string): number {
    if (reps === "Fundamentals") return 5;
    
    // Extract numbers from "3 sets x 6 reps" format
    const match = reps.match(/(\d+)\s*sets?\s*x\s*(\d+)/i);
    if (match) {
        const sets = parseInt(match[1]);
        const repsPerSet = parseInt(match[2]);
        // Rough estimate: 30 seconds per rep
        return Math.ceil((sets * repsPerSet * 0.5) / 60) || 10;
    }
    
    return 10; // Default 10 minutes
}

export class DrillVectorStoreManager {
    private embeddings: OpenAIEmbeddings;
    private pinecone: Pinecone;
    private vectorStore: PineconeStore | null = null;
    
    constructor() {
        this.embeddings = new OpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY!,
            batchSize: 100,
        });
        
        this.pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        });
    }

    async initializeVectorStore(indexName: string = "drills-idx"): Promise<PineconeStore> {
        const index = this.pinecone.Index(indexName);
        
        this.vectorStore = new PineconeStore(this.embeddings, {
            pineconeIndex: index,
            maxConcurrency: 5,
        });
        
        return this.vectorStore;
    }

    // Main method to process your JSON drills
    async processDrillsFromJSON(drillsJSON: DrillData[], batchSize: number = 50): Promise<void> {
        if (!this.vectorStore) {
            throw new Error("Vector store not initialized. Call initializeVectorStore() first.");
        }

        // Transform the drill data
        const transformedDrills = transformDrillData(drillsJSON);
        
        console.log(`Processing ${transformedDrills.length} drills in batches of ${batchSize}`);
        
        // Process in batches
        for (let i = 0; i < transformedDrills.length; i += batchSize) {
            const batch = transformedDrills.slice(i, i + batchSize);
            const batchNum = Math.floor(i/batchSize) + 1;
            const totalBatches = Math.ceil(transformedDrills.length/batchSize);
            
            console.log(`Processing batch ${batchNum}/${totalBatches}`);
            
            try {
                const { Document } = await import("langchain/document");
                const docs = batch.map(item => 
                    new Document({ 
                        pageContent: item.text, 
                        metadata: item.metadata 
                    })
                );
                
                await this.vectorStore.addDocuments(docs);
                console.log(`✓ Batch ${batchNum} completed`);
                
                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`✗ Failed batch ${batchNum}:`, error);
                throw error; // Re-throw to handle at higher level
            }
        }
        
        console.log("✓ All drills successfully indexed in vector database");
    }

    // Search for relevant drills based on user needs
    async searchDrills(
        query: string,
        filters?: {
            skillLevels?: string[];
            skills?: string[];
            contentType?: string;
            difficulty?: string;
        },
        topK: number = 10
    ): Promise<Array<any>> {
        if (!this.vectorStore) {
            throw new Error("Vector store not initialized");
        }

        const filter: any = {};
        
        if (filters?.skillLevels && filters.skillLevels.length > 0) {
            filter.skillLevels = { $in: filters.skillLevels };
        }
        
        if (filters?.contentType) {
            filter.category = filters.contentType;
        }
        
        if (filters?.difficulty) {
            filter.difficulty = filters.difficulty;
        }

        const results = await this.vectorStore.similaritySearchWithScore(
            query,
            topK,
            filter
        );

        return results.map(([doc, score]) => ({
            ...doc.metadata,
            relevanceScore: score,
            matchedContent: doc.pageContent.substring(0, 150) + "..."
        }));
    }
}

// Usage example
export async function indexDrills(drillsFilePath: string) {
    try {
        // Load your JSON file
        const fs = await import('fs/promises');
        const drillsJSON: DrillData[] = JSON.parse(
            await fs.readFile(drillsFilePath, 'utf-8')
        );
        
        // Initialize manager
        const manager = new DrillVectorStoreManager();
        await manager.initializeVectorStore("drills-idx");
        
        // Process and index drills
        await manager.processDrillsFromJSON(drillsJSON);
        
        console.log("Indexing complete!");
        
        // Example search
        const results = await manager.searchDrills(
            "drills for improving timing and hitting offspeed pitches",
            { skillLevels: ["High School"] },
            5
        );
        
        console.log("\nSample search results:", results);
        
    } catch (error) {
        console.error("Error indexing drills:", error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    indexDrills('drills2.json')
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}