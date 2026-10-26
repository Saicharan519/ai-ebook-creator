import { createBookInputSchema } from "@ebook/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { TextAreaField, TextField } from "../../components/ui/TextField";
import { errorMessage, fieldErrorsFrom, type FieldErrors } from "../../lib/form-errors";
import { useCurrentUser } from "../auth/auth-context";
import { useCreateBook } from "./books-api";

const FORM_ID = "create-book-form";

export function CreateBookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const createBook = useCreateBook();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => (form.get(name) as string).trim() || undefined;

    const parsed = createBookInputSchema.safeParse({
      title: form.get("title"),
      author: form.get("author"),
      genre: optional("genre"),
      premise: optional("premise"),
      writingStyle: optional("writingStyle"),
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setFieldErrors({});

    const book = await createBook.mutateAsync(parsed.data).catch(() => null);
    if (book) navigate(`/books/${book.id}`);
  }

  function close() {
    createBook.reset();
    setFieldErrors({});
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New book"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={createBook.isPending}>
            Create book
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField label="Title" name="title" autoFocus error={fieldErrors.title} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Author"
            name="author"
            defaultValue={user.name}
            error={fieldErrors.author}
          />
          <TextField
            label="Genre"
            name="genre"
            placeholder="Fantasy, memoir, study notes…"
            error={fieldErrors.genre}
          />
        </div>
        <TextAreaField
          label="Premise"
          name="premise"
          placeholder="What is the book about? A few sentences is enough."
          hint="Optional. The AI co-writer will use this later."
          error={fieldErrors.premise}
        />
        <TextField
          label="Writing style"
          name="writingStyle"
          placeholder="e.g. first person, past tense, warm and witty"
          error={fieldErrors.writingStyle}
        />
        {createBook.isError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage(createBook.error)}
          </p>
        )}
      </form>
    </Modal>
  );
}
