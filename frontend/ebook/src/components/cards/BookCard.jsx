import { useNavigate } from "react-router-dom";
import { BASE_URL } from "../../utils/Apipath";
import { Edit, Trash2, BookOpen } from "lucide-react";

const BookCard = ({ book, onDelete }) => {
    const navigate = useNavigate();

    const coverImageUrl = book.coverImage
        ? (book.coverImage.startsWith("/uploads")
            ? `${BASE_URL}/backend${book.coverImage}`.replace(/\\/g, "/")
            : `${BASE_URL}/backend/uploads${book.coverImage}`.replace(/\\/g, "/"))
        : null;

    return (
        <div
            className="group relative bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-gray-300 hover:shadow-xl hover:shadow-gray-100/50 hover:-translate-y-1 cursor-pointer"
            onClick={() => navigate(`/view-book/${book._id}`)}
        >
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                {coverImageUrl ? (
                    <img
                        src={coverImageUrl}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = null; }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                        <BookOpen className="w-12 h-12 mb-2 text-slate-300" />
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">No Cover</span>
                    </div>
                )}
                {/* Floating Action Buttons */}
                <div className="absolute top-3 right-3 z-10 flex gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/edit-book/${book._id}`);
                        }}
                        className="p-2 rounded-xl bg-white/95 text-slate-700 hover:text-indigo-600 shadow-sm border border-slate-100 hover:shadow-md hover:scale-110 transition-all duration-200"
                        title="Edit Book"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(book._id);
                        }}
                        className="p-2 rounded-xl bg-white/95 text-slate-700 hover:text-red-600 shadow-sm border border-slate-100 hover:shadow-md hover:scale-110 transition-all duration-200"
                        title="Delete Book"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="p-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">
                        {book.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {book.author}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BookCard;