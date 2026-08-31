import { useState, useRef, useEffect } from "react";
import {
  Plus, Sparkles, Trash2, ArrowLeft,
  BookOpen, Hash, Lightbulb, Palette,
} from "lucide-react";

import Modal from "../ui/Modal";
import InputField from "../ui/InputField";
import SelectField from "../ui/selectfield";
import Button from "../ui/Button";

import axiosInstance from "../../utils/axiosdistance";
import { API_PATHS } from "../../utils/Apipath";
import toast from "react-hot-toast";
import { useAuth } from "../../context/Authcontext";

const CreateBookModal = ({ isOpen, onClose, onBookCreated }) => {
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [bookTitle, setBookTitle] = useState("");
  const [numChapters, setNumChapters] = useState(5);
  const [aiTopic, setAiTopic] = useState("");
  const [aiStyle, setAiStyle] = useState("Informative");
  const [chapters, setChapters] = useState([]);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isFinalizingBook, setIsFinalizingBook] = useState(false);
  const chaptersCountRef = useRef(null); // ✅ was: useRef(0) — should be null for DOM refs

  const resetModal = () => {
    setStep(1);
    setBookTitle("");
    setNumChapters(5);
    setAiTopic("");
    setAiStyle("Informative");
    setChapters([]);
    setIsGeneratingOutline(false);
    setIsFinalizingBook(false);
  };

  const handleGenerateOutline = async () => {
    if (!bookTitle || !numChapters) {
      toast.error("Please provide book title and number of chapters");
      return;
    }
    setIsGeneratingOutline(true);
    try {
      const response = await axiosInstance.post(API_PATHS.BOOKS.GENERATE_OUTLINE, {
        topic: bookTitle,
        description: aiTopic || "",
        style: aiStyle,
        numChapters: numChapters,
      });
      setChapters(response.data.chapters);
      setStep(2);
      toast.success("Outline generated successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to generate outline");
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleChapterChange = (index, field, value) => {
    const updatedChapters = [...chapters];
    updatedChapters[index][field] = value;
    setChapters(updatedChapters);
  };

  const handleDeleteChapter = (index) => {
    if (chapters.length <= 1) return;
    setChapters(chapters.filter((_, i) => i !== index));
  };

  const handleADDChapter = () => {
    setChapters([...chapters, { title: `Chapter ${chapters.length + 1}`, description: "" }]);
  };

  const handleFinalizeBook = async () => {
    if (!bookTitle || chapters.length === 0) {
      toast.error("Book title and at least one chapter are required");
      return;
    }
    setIsFinalizingBook(true);
    try {
      const response = await axiosInstance.post(API_PATHS.BOOKS.CREATE_BOOK, {
        title: bookTitle,
        author: user.name || "Unknown Author",
        chapters: chapters,
      });
      toast.success("Book created successfully");
      onBookCreated(response.data._id);
      onClose();
      resetModal();
    } catch (error) {
      console.log("TESR_", bookTitle, chapters); // ✅ Bug 1: added missing comma
      toast.error(error.response?.data?.message || "Failed to create book");
    } finally {
      setIsFinalizingBook(false);
    }
  };

  // ✅ Bug 2 & 3: useEffect was outside the component due to stray closing brace
  useEffect(() => {
    if (step === 2 && chaptersCountRef.current) {
      const scrollableDiv = chaptersCountRef.current;
      scrollableDiv.scrollTo({ // ✅ Bug 4: was scrollTo {{ }} (double braces)
        top: scrollableDiv.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chapters.length, step]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        resetModal();
      }}
      title="Create New Book"
    >
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-500 text-sm font-semibold">
              1
            </div>
            <div className="flex-1 h-0.5 bg-gray-200"></div>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-gray-500 text-sm font-semibold">
              2
            </div>
          </div>

          <InputField
            icon={BookOpen}
            label="Book Title"
            placeholder="Enter your book title"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
          />
          {/* ✅ Bug 7: was `inputField` (lowercase) — component names must be capitalized */}
          <InputField
            icon={Hash}
            label="Number of Chapters"
            type="number"
            placeholder="5"
            value={numChapters}
            onChange={(e) => setNumChapters(parseInt(e.target.value) || 1)}
            min={1}
            max={20}
          />
          <InputField
            icon={Lightbulb}
            label="Topic (optional)"
            placeholder="Specific topic for AI topic generation"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
          />
          <SelectField
            icon={Palette}
            label="Writing Style"
            value={aiStyle}
            onChange={(e) => setAiStyle(e.target.value)}
            options={[         // ✅ Bug 6: was closed with }} instead of ]}
              "Informative",
              "Storytelling",
              "Casual",
              "Professional",
              "Humorous",
            ]}
          />
          <div className="flex justify-end pt-4">
            <Button onClick={handleGenerateOutline} isLoading={isGeneratingOutline} icon={Sparkles}>
              Generate Outline with AI
            </Button>
          </div>
        </div>
      )}

      {/* ✅ Bug 5: was `(step === 2 &&` — missing opening curly brace */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-gray-500 text-sm font-semibold">
              1
            </div>
            <div className="flex-1 h-0.5 bg-violet-600"></div>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-500 text-sm font-semibold">
              2
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Review Chapters</h3>
            <span className="text-sm text-gray-500">
              {chapters.length} chapters generated by AI. You can edit the titles and descriptions as needed.
            </span>
          </div>

          <div ref={chaptersCountRef} className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {/* ✅ Bug 8: was `chepters.length` — typo */}
            {chapters.length === 0 ? (
              <div className="text-center py-12 px-4 bg-gray-50 rounded-xl">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">No chapters generated yet.</p>
              </div>
            ) : (
              chapters.map((chapter, index) => (
                <div
                  key={index}
                  className="group p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all bg-white"
                >
                  <div className="flex items-start gap-4 mb-2">
                    <div className="flex items-center justify-center w-6 h-6 bg-violet-200 rounded-full text-violet-500 text-xs font-semibold flex-shrink-0">
                      {index + 1}
                    </div>
                    {/* ✅ Bug 9: was `<Input>` (not imported) — use native <input> */}
                    <input
                      type="text"
                      value={chapter.title}
                      onChange={(e) => handleChapterChange(index, "title", e.target.value)}
                      placeholder="Chapter Title"
                      className="flex-1 text-base font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                    />
                    <button
                      onClick={() => handleDeleteChapter(index)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                      title="Delete Chapter"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                  <textarea
                    value={chapter.description}
                    onChange={(e) => handleChapterChange(index, "description", e.target.value)}
                    placeholder="Brief description of what this chapter will cover..."
                    rows={2}
                    className="w-full pl-9 text-sm text-gray-700 bg-transparent border-none focus:outline-none focus:ring-0 resize-none placeholder:text-gray-400"
                  />
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-200">
            <Button variant="ghost" onClick={() => setStep(1)} icon={ArrowLeft}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleADDChapter} icon={Plus}>
                Add Chapter
              </Button>
              <Button onClick={handleFinalizeBook} isLoading={isFinalizingBook}>
                Create Book
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default CreateBookModal;