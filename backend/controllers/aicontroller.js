const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GIMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
//generate a book outline based on a prompt
//POST /api/ai/generate-outline
//access: private
const generateOutline = async (req, res) => {
    try {
        const { topic, style, numChapters, description } = req.body;
        if (!topic) {
            return res.status(400).json({ message: "Topic is required" });
        }
        const prompt = `Generate an outline for a book about "${topic}". The writing style should be "${style}". Create exactly ${numChapters} chapters. Additional context: "${description}". You MUST return ONLY a JSON array containing the chapters. Do not include any other text or markdown formatting. Each chapter object must have exactly two string properties: "title" and "description".`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        const text = response.text;
        //find and extract the js array from the responsive text
        const startIndex = text.indexOf("[");
        const endIndex = text.lastIndexOf("]");
        if (startIndex === -1 || endIndex === -1) {
            console.error("No array found in response:", text);
            return res
                .status(500)
                .json({ message: "Error generating outline" });
        }
        const jsonstring = text.substring(startIndex, endIndex + 1);
        //validate if response is valid json
        try {
            const outline = JSON.parse(jsonstring);
            res.status(200).json({ chapters: outline });
        } catch (error) {
            console.error("Invalid JSON in response:", jsonstring);
            res.status(500).json({
                message: "Error generating outline"
            });
        }
    } catch (error) {
        console.error("Error generating outline:", error);
        res.status(500).json({ message: "Server error" });
    }
};

//generate content for a chapter based on a prompt
//POST /api/ai/chapter-content
//access: private
const generateChapterContent = async (req, res) => {
    try {
        const { chapterTitle, chapterDescription, style } = req.body;
        if (!chapterTitle) {
            return res.status(400).json({ message: "Chapter title is required" });
        }
        const prompt = `Write a detailed, engaging, and rich content section for a book chapter.
Chapter Title: "${chapterTitle}"
Chapter Description/Focus: "${chapterDescription}"
Writing Style: "${style}"

Please write the full, comprehensive content of this chapter. Use proper formatting like paragraphs and subheadings (e.g. using markdown format) if helpful, but do NOT include the main title header of the chapter at the very start. Just begin writing the content itself directly. Make it flow naturally.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        res.status(200).json({ content: response.text });
    } catch (error) {
        console.error("Error generating chapter content:", error);
        res.status(500).json({ message: "Server error" });
    }
};
module.exports = {
    generateOutline,
    generateChapterContent,
};