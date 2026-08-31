import { useMemo, useState } from "react";
import { Sparkles, Type, Eye, Maximize2 } from "lucide-react";
import Button from "../ui/Button";
import InputField from "../ui/InputField";
import SimpleMDEditor from "./SimpleMDEditor";

const ChapterEditorTab = ({
  book = {
    title: "Untitled",
    chapters: [
      {
        title: "Chapter 1",
        content: "",
      },
    ],
  },
  selectedChapterIndex = 0,
  onChapterChange = () => {},
  onGenerateChapterContent = () => {},
  isGenerating,
}) => {
  const[isPreviewMode, setIsPreviewMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  //simple markdown parser
  const formatMarkdown = (content) => {
    return content
   // Headers
.replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold mb-4 mt-6">$1</h3>')
.replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mb-4 mt-8">$1</h2>')
.replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mb-6 mt-8">$1</h1>')

// Bold and Italic
.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

// Blockquotes
.replace(/^> (.*$)/gm,
  '<blockquote class="border-l-4 border-violet-500 pl-4 italic text-gray-700 my-4">$1</blockquote>'
)

// Unordered Lists
.replace(/^- (.*$)/gm, '<li class="ml-4 mb-1">$1</li>')
.replace(/(<li.*<\/li>)/gs, '<ul class="my-4">$1</ul>')

// Ordered Lists
.replace(/^\d+\. (.*$)/gm,
  '<li class="ml-4 mb-1 list-decimal">$1</li>'
)
.replace(/(<li class="ml-4 mb-1 list-decimal">.*<\/li>)/gs,
  '<ol class="my-4 ml-4">$1</ol>'
)

// Paragraphs
.split('\n\n')
.map(paragraph => {
  paragraph = paragraph.trim();

  if (!paragraph) return '';

  // Skip if already wrapped in HTML tags
  if (paragraph.startsWith('<')) return paragraph;

  return `<p class="mb-4 text-justify">${paragraph}</p>`;
})
.join('');

  };
  const mdeOptions = useMemo(() => {
    return {
      autofocus: true,
      spellChecker: false,
      toolbar:[
        "bold",
        "italic",
        "heading",
        "|",
        "quote",
        "unordered-list",
        "ordered-list",
        "|",
        "link",
        "image",
        "|",
        "preview",
        "side-by-side",
        "fullscreen",
      ],
    };
    },[]);

    if(selectedChapterIndex ==null|| !book.chapters[selectedChapterIndex]){
      return (
        <div className="flex-1 flex items-center justify-center ">
          <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <Type className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 text-lg">Please select a chapter to edit</p>
        <p className="text-gray-400 text-sm mt-1">choose from the sidebar to begin writing</p>
        </div>
        </div>
      );
    }
      const currentChapter = book.chapters[selectedChapterIndex];
  return (
    <div className={`flex-1 flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-white p-6" : ""}`}>
  {/*header*/}
  <div className="border-b border-gray-200 bg-white">
    <div className="px-8 py-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-0 justify-between ">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-800">Chapter Editor</h1>
          <p className="text-sm md:text-base text-gray-500">
          Editing:{ currentChapter.title || `Chapter ${selectedChapterIndex + 1}` }
          </p>
        </div>


        <div className="flex items-center gap-3">
          {/*editor controls*/}
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <Button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${isPreviewMode ? "bg-violet-100 text-violet-700" : "bg-gray-600 hover:bg-gray-50"}`}
            >
              preview
            </Button>
            </div>

            <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-2 rounded-md ${isFullscreen ? "bg-violet-100 text-violet-700" : "bg-gray-600 hover:bg-gray-50"}`}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <Button
            onClick={() => onGenerateChapterContent(selectedChapterIndex)}
            isLoading={isGenerating === selectedChapterIndex}
            icon={Sparkles}
            size="sm"
            >
              generate with AI
            </Button>
          </div>
        </div>
      </div>
    </div>
    {/*content area*/}

  <div className="flex-1 overflow-hidden">
    <div className="h-full bg-white px-8 py-6">
      <div className="h-full bg-white">
        <div className="space-y-6 h-full flex flex-col">
          {/*chapter title input*/}
          <InputField
          label="Chapter Title"
          name=" Title"
          value={currentChapter.title|| ''}
          onChange={onChapterChange}
          placeholder="Enter chapter title"
          className="text-xl font-semibold"
          />
          </div>
          {/*editor preview area*/}
          <div className="flex-1 min-h-0">
          {!isPreviewMode ? (
            <div className="h-full border border-gray-200 rounded-lg overflow-y-auto">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 ">
                <div className="flex item center gap-2 text-sm text-gray-500">
                  <Eye className="w-4 h-4" />
                  <span className="text-gray-500">Preview mode is off. Click the preview button to see the formatted content.</span>
                </div>
              </div>
              <div className="h-full">
                <h1 className="text-2xl font-bold mb-4">
                  {currentChapter.title || `Untitled Chapter `}
                </h1>
                <div
                  className="prose prose-violet max-w-none"
                  style={{
                    fontfamily: 'charter, Georgia, "Times New Roman" serif',
                    lineHeight: "1.7",
                   }}
                  dangerouslySetInnerHTML={{ __html: currentChapter.content? formatMarkdown(currentChapter.content) : "<p class='text-gray-500'>No content to preview. Start writing or generate content with AI.</p>" }}
                />
              </div>
            </div>
          ) : (
            <div className="h-full">
            <SimpleMDEditor
            value={currentChapter.content || ""}
            onChange={(value) =>
               onChapterChange({target: { name: "content", value }})
              }
            options={mdeOptions}
            />
            </div>
            )
          }
          </div>
          {/*status bar*/}
            <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <span>
                  words: {currentChapter.content ? currentChapter.content.split(/\s+/).filter(Boolean).length : 0}
                  </span>
                  <span >|
                  characters: {currentChapter.content ? currentChapter.content.length : 0}
                  </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full "></div>
                      <span>Auto saved:</span>
                      </div>
                      </div>

                

          </div>
        </div>
      </div>
    </div>
  );
};



export default ChapterEditorTab;