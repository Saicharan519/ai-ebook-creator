import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Book } from "lucide-react";

import Navbar from "../components/layout/Navbar";
import axiosInstance from "../utils/axiosdistance";
import { API_PATHS } from "../utils/Apipath";
import ViewBook from "../components/view/ViewBook";

const ViewBookSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-8 bg-slate-200 rounded w-1/2 mb-4"></div>
    <div className="h-4 bg-slate-200 rounded w-1/4 mb-8"></div>
    <div className="flex gap-8">
      <div className="w-1/4">
        <div className="h-96 bg-slate-200 rounded-lg"></div>
      </div>
      <div className="w-3/4">
        <div className="h-full bg-slate-200 rounded-lg"></div>
      </div>
    </div>
  </div>
);

const ViewBookPage = () => {
    const [book, setBook] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const {bookId} = useParams();

    useEffect(() => {
        const fetchBook = async () => {
            try {
                const response = await axiosInstance.get(`${API_PATHS.BOOKS.GET_BOOK_BY_ID}/${bookId}`);
                setBook(response.data);
            } catch (error) {
                toast.error("Failed to fetch book");
            } finally {
                setIsLoading(false);
            }
        };

        fetchBook();
    }, [bookId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col">
        {isLoading ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ViewBookSkeleton />
          </div>
        ) : book ? (
          <ViewBook book={book} />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Book className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              eBook not found
            </h3>
            <p className="text-slate-500 mb-6 max-w-md text-center">
              The eBook you are looking for does not exist or has been removed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewBookPage;