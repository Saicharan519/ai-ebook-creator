import InputField from "../ui/InputField";
import Button from "../ui/Button";
import { UploadCloud, BookOpen } from "lucide-react";
import { BASE_URL } from "../../utils/Apipath";

const BookDetailsTab = ({
  book,
  onBookChange,
  onCoverUpload,
  isUploading,
  fileInputRef,
}) => {
  const coverImageUrl =
    book.coverImage?.startsWith("http")
      ? book.coverImage
      : book.coverImage
        ? `${BASE_URL}/backend${book.coverImage}`.replace(/\/\//g, "/")
        : null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mt-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Book Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Title"
            name="title"
            value={book.title}
            onChange={onBookChange}
          />

          <InputField
            label="Author"
            name="author"
            value={book.author}
            onChange={onBookChange}
          />

          <div className="md:col-span-2">
            <InputField
              label="Subtitle"
              name="subtitle"
              value={book.subtitle || ""}
              onChange={onBookChange}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mt-6">
        <h3 className="text-lg font-semibold mb-3">Cover Image</h3>

        <div className="">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt="Cover"
              className="w-32 h-48 object-cover rounded-md mb-4 border border-slate-300 shadow-sm"
            />
          ) : (
            <div className="w-32 h-48 bg-slate-50 border border-slate-200 rounded-md mb-4 flex flex-col items-center justify-center text-slate-400">
              <BookOpen className="w-8 h-8 mb-2 text-slate-300" />
              <span className="text-xs">No Cover Image</span>
            </div>
          )}
          <p className="text-sm text-slate-500 mb-4">
            upload a new cover image to replace the existing one. Supported formats:
            recommended size: 400x600px.
          </p>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={onCoverUpload}
            className="hidden"
            accept="image/*"
          />
          
          <Button
          variant="secondary"
            onClick={() => fileInputRef.current.click()}
            icon={UploadCloud}
            isLoading={isUploading}
          >
            Upload image
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookDetailsTab;