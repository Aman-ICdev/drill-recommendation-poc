import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { Drill, UserProgress } from "../types/types";
import dotenv from "dotenv";
dotenv.config();

export class VectorStoreManager {
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

    async batchProcessDrills(drills: Drill[], batchSize: number = 100): Promise<void> {
        if (!this.vectorStore) {
            throw new Error("Vector store not initialized");
        }

        console.log(`Processing ${drills.length} drills in batches of ${batchSize}`);
        
        for (let i = 0; i < drills.length; i += batchSize) {
            const batch = drills.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(drills.length/batchSize)}`);
            
            const texts = batch.map(drill => 
                `${drill.title} ${drill.description} ${drill.focus?.join(' ')} ${drill.category} ${drill.difficulty} ${drill.tags?.join(' ')}`
            );
            
            const metadatas = batch.map(drill => ({
                id: drill.id,
                title: drill.title,
                category: drill.category || "general",
                difficulty: drill.difficulty || "beginner",
                focus: drill.focus || [],
                duration: drill.duration || 10,
                prerequisites: drill.prerequisites || []
            }));

            try {
                const { Document } = await import("langchain/document");
                const docs = texts.map((text, idx) => new Document({ pageContent: text, metadata: metadatas[idx] }));
                await this.vectorStore.addDocuments(docs);
                console.log(`Processed batch ${Math.floor(i/batchSize) + 1}`);
            } catch (error) {
                console.error(`Failed batch ${Math.floor(i/batchSize) + 1}:`, error);
            }
        }
        
        console.log("All drills processed and stored in vector database");
    }

    async findRelevantDrills(
        userProfile: string,
        userProgress: UserProgress,
        topK: number = 30,
        skillLevel?: string,
        equipment?: string[],

    ): Promise<(Drill & { relevanceScore: number })[]> {
        if (!this.vectorStore) {
            throw new Error("Vector store not initialized");
        }

        const filter: any = {};

        if (userProgress.completedDrillIds.length > 0) {
            filter.id = { $nin: userProgress.completedDrillIds };
        }

        const enhancedQuery = `
            ${userProfile}
            Skill level: ${userProgress.skillLevel || 'beginner'}
            Weak areas: ${userProgress.weakAreas?.join(', ') || 'none'}
            Preferences: ${userProgress.preferences?.join(', ') || 'none'}
            Recent focus: ${userProgress.recentActivity?.join(', ') || 'none'}
            Skill Level: ${skillLevel || 'any'}
            Equipment: ${equipment && equipment.length > 0 ? equipment.join(', ') : 'none'}
        `;

        // Get more for deduplication
        const results = await this.vectorStore.similaritySearchWithScore(
            enhancedQuery, 
            topK * 2, // Get 2x results before deduplication
            filter
        );

        const drillsWithScores = results.map(([doc, score]) => ({
            id: doc.metadata.id,
            title: doc.metadata.title,
            name: doc.metadata.name || doc.metadata.id,
            description: doc.pageContent.substring(0, 200),
            reps: "TBD", // Get from full drill data
            category: doc.metadata.category,
            difficulty: doc.metadata.difficulty,
            focus: doc.metadata.focus,
            duration: doc.metadata.duration,
            prerequisites: doc.metadata.prerequisites,
            relevanceScore: score
        }));
        return drillsWithScores;
    }

    getVectorStore(): PineconeStore | null {
        return this.vectorStore;
    }
}