import { updateBookInputSchema, type Book } from "@ebook/shared";
import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { TextAreaField, TextField } from "../../components/ui/TextField";
import { errorMessage, fieldErrorsFrom, type FieldErrors } from "../../lib/form-errors";
import { BookCover } from "./BookCover";
import { useRemoveCover, useUpdateBook, useUploadCover } from "./books-api";

const FORM_ID = "book-details-form";
const MAX_COVER_BYTES = 2 * 1024 * 1024;

export function BookDetailsDialog({
  book,
  open,
  onClose,
}: {
  book: Book;
  open: boolean;
  onClose: () => void;
}) {
  const updateBook = useUpdateBook(book.id);
  const uploadCover = useUploadCover(book.id);
  const removeCover = useRemoveCover(book.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [coverError, setCoverError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = updateBookInputSchema.safeParse({
      title: form.get("title"),
      subtitle: form.get("subtitle"),
      author: form.get("author"),
      genre: form.get("genre"),
      premise: form.get("premise"),
      writingStyle: form.get("writingStyle"),
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setFieldErrors({});
    await updateBook.mutateAsync(parsed.data).then(onClose, () => {});
  }

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCoverError(null);
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setCoverError("Choose a JPEG or PNG image.");
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setCoverError("Choose an image under 2 MB.");
      return;
    }
    uploadCover.mutate(file, { onError: (error) => setCoverError(errorMessage(error)) });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book details"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={updateBook.isPending}>
            Save details
          </Button>
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-2">
          <BookCover book={book} />
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleCoverChange}
          />
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            loading={uploadCover.isPending}
            onClick={() => fileInput.current?.click()}
          >
            {!uploadCover.isPending && <ImageUp className="h-4 w-4" />}
            {book.coverUrl ? "Change cover" : "Add cover"}
          </Button>
          {book.coverUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-red-600"
              loading={removeCover.isPending}
              onClick={() => removeCover.mutate()}
            >
              <Trash2 className="h-4 w-4" />
              Remove cover
            </Button>
          )}
          {coverError && <p className="text-xs text-red-600">{coverError}</p>}
          <p className="text-xs text-stone-500">JPEG or PNG, up to 2 MB.</p>
        </div>

        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
          <TextField
            label="Title"
            name="title"
            defaultValue={book.title}
            error={fieldErrors.title}
          />
          <TextField
            label="Subtitle"
            name="subtitle"
            defaultValue={book.subtitle}
            error={fieldErrors.subtitle}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Author"
              name="author"
              defaultValue={book.author}
              error={fieldErrors.author}
            />
            <TextField
              label="Genre"
              name="genre"
              defaultValue={book.genre}
              error={fieldErrors.genre}
            />
          </div>
          <TextAreaField
            label="Premise"
            name="premise"
            defaultValue={book.premise}
            error={fieldErrors.premise}
          />
          <TextField
            label="Writing style"
            name="writingStyle"
            defaultValue={book.writingStyle}
            error={fieldErrors.writingStyle}
          />
          {updateBook.isError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage(updateBook.error)}
            </p>
          )}
        </form>
      </div>
    </Modal>
  );
}
