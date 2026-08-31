const bookService = require("../services/bookservice");

const createBook = async (req, res) => {
    try {
        const { title, author, description, subtitle, chapters } = req.body;
        if (!title || !author) {
            return res.status(400).json({ message: "Title and author are required" });
        }
        const book = await bookService.createBook({
            userId: req.user._id,
            title,
            author,
            subtitle,
            chapters,
        });
        res.status(201).json(book);

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
// @route GET /api/books
//  @desc Get all books
// @access Private
const getBooks = async (req, res) => {
    try {
        const books = await bookService.getBooks({ userId: req.user._id });
        res.status(200).json(books);
    } catch (error) {
        console.error("Error in getBooks:", error);
        res.status(500).json({ message: "Server error" });
    }

}
// @route GET /api/books/:id
//  @desc Get book by id
// @access Private
const getBookById = async (req, res) => {
    try {
        const book = await bookService.getBookById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }
        if (book.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized to access this book" });
        }
        res.status(200).json(book);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }

}   
// @route PUT /api/books/:id
//  @desc Update book by id
// @access Private
const updateBook = async (req, res) => {   
    try {
        const book = await bookService.updateBook(req.params.id, req.body);
        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }
        res.status(200).json(book);
    } catch (error) {
        console.error("Error in updateBook:", error);
        res.status(500).json({ message: "Server error" });
    } 
}
// @route DELETE /api/books/:id
//  @desc Delete book by id
// @access Private
const deleteBook = async (req, res) => {
    try {
        const book = await bookService.deleteBook(req.params.id);
        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }
        res.status(200).json({ message: "Book deleted successfully" });
    } catch (error) {
        console.error("Error in deleteBook:", error);
        res.status(500).json({ message: "Server error" });
    }

}
// @route POST /api/books/:id/cover
//  @desc Update book cover image
// @access Private
const updateBookCover = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please upload an image file" });
        }
        // Save the cover image path relative to server root: /uploads/filename
        const coverPath = `/uploads/${req.file.filename}`;
        const book = await bookService.updateBookCover(req.params.id, coverPath);
        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }
        res.status(200).json(book);
    } catch (error) {
        console.error("Error in updateBookCover:", error);
        res.status(500).json({ message: "Server error" });
    }

}
module.exports = {
    createBook,
    getBooks,
    getBookById,
    updateBook,
    deleteBook,
    updateBookCover,
};

    
