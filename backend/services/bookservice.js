const Book = require("../models/Book");

// Create a new book
exports.createBook = async (data) => {
    try {
        const book = new Book({
            userid: data.userId,
            title: data.title,
            author: data.author,
            subtitle: data.subtitle || "",
            chepters: data.chapters || [],
        });
        await book.save();
        return book;
    } catch (error) {
        throw new Error(`Error creating book: ${error.message}`);
    }
};

// Get all books for a user
exports.getBooks = async (filter) => {
    try {
        const books = await Book.find({ userid: filter.userId }).sort({ createdAt: -1 });
        return books;
    } catch (error) {
        throw new Error(`Error fetching books: ${error.message}`);
    }
};

// Get a single book by ID
exports.getBookById = async (bookId) => {
    try {
        const book = await Book.findById(bookId);
        return book;
    } catch (error) {
        throw new Error(`Error fetching book: ${error.message}`);
    }
};

// Update a book by ID
exports.updateBook = async (bookId, data) => {
    try {
        const updateData = { ...data };
        if (data.chapters !== undefined) {
            updateData.chepters = data.chapters;
            delete updateData.chapters;
        }
        if (data.userId !== undefined) {
            updateData.userid = data.userId;
            delete updateData.userId;
        }
        if (data.coverImage !== undefined) {
            updateData.coverimage = data.coverImage;
            delete updateData.coverImage;
        }
        const book = await Book.findByIdAndUpdate(bookId, updateData, { new: true });
        return book;
    } catch (error) {
        throw new Error(`Error updating book: ${error.message}`);
    }
};

// Delete a book by ID
exports.deleteBook = async (bookId) => {
    try {
        const book = await Book.findByIdAndDelete(bookId);
        return book;
    } catch (error) {
        throw new Error(`Error deleting book: ${error.message}`);
    }
};

// Update book cover image
exports.updateBookCover = async (bookId, coverImagePath) => {
    try {
        const book = await Book.findByIdAndUpdate(
            bookId,
            { coverimage: coverImagePath },
            { new: true }
        );
        return book;
    } catch (error) {
        throw new Error(`Error updating book cover: ${error.message}`);
    }
};
