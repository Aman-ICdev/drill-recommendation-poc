import { Request, Response } from "express"
import fs from 'fs';
import path from 'path';

import { ScalableDrillRecommendationSystem } from "./drillRecommendation.ts";
import { Drill, DrillBlock } from "./types/types.ts";

const system = new ScalableDrillRecommendationSystem();

const userProfile = `
    User is an intermediate level athlete focusing on baseball hitting skills.
    Drills they Liked: Rolling Stride Tee Drill, One Knee Drill
    Drills they Disliked: Heavy Bat Swing, Long Toss
    Recent Activity: Tee Work, Soft Toss, Batting Practice
    Equipment: Standard baseball bat, batting tee, baseballs
`;

// const completedDrillIds = ['696d7582-de58-47e1-8084-5b96cacaa9fa'];
// const user = 'user1';

// const skillLevel = 'High School';
// const equipments = ['Baseballs', 'Glove'];



// system.createPersonalizedDrillBlocks(userProfile, {userId: user, completedDrillIds}, skillLevel, equipments).then((blocks: DrillBlock[]) => {
//     console.log("Generated Drill Blocks:", JSON.stringify(blocks, null, 2));
// }).catch(err => {
//     console.error("Error generating drill blocks:", err);
// });


export async function recommendController(req: Request, res: Response) {

    try {

        const { skillLevel, equipments, completedDrillIds, likedDrillIds, dislikedDrillIds } = req.body;

        const drillsJson = fs.readFileSync(path.join(process.cwd(), 'drills2.json'), 'utf-8');
        const allDrills = JSON.parse(drillsJson);

        console.log(allDrills.length);

        const likedDrillNames = allDrills.filter((drill: any) => likedDrillIds.includes(drill.id)).map((drill: any) => drill.title);

        const dislikedDrillNames = allDrills.filter((drill: any) => dislikedDrillIds.includes(drill.id)).map((drill: any) => drill.title);

        completedDrillIds.push(...likedDrillIds);
        completedDrillIds.push(...dislikedDrillIds);

        const userProfile = `
            User is an ${skillLevel} level athlete.
            Drills they Liked: ${likedDrillNames.join(', ')}
            Drills they Disliked: ${dislikedDrillNames.join(', ')}
            Equipment: ${equipments.join(', ')}
        `;

        system.createPersonalizedDrillBlocks(userProfile, { userId: 'userId', completedDrillIds }, skillLevel, equipments).then((blocks: Drill[]) => {
            console.log("Generated Drill Blocks:", JSON.stringify(blocks, null, 2));
            res.json(blocks);
        }).catch(err => {
            console.error("Error generating drill blocks:", err);
            res.status(500).json({ error: "Failed to generate drill blocks" });
        });

    } catch (error) {
        console.error("Error in recommendation controller:", error);
        res.status(500).json({ error: "Internal server error" });
    }

    // Your recommendation logic here

}