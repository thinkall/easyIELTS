# Books — your private PDF library

The **Books** section (`/books`) lets you read PDF study books in the browser. Your files stay
on your machine: put them in the gitignored **`private/books/`** folder, which is never
committed to git or uploaded anywhere.

> Only add material you are legally entitled to use, and keep this site private. easyIELTS does
> not bundle or distribute any books — it only reads the PDFs you place in `private/books/`.

## How to add books

1. Create the folder if it doesn't exist:
   ```bash
   mkdir -p private/books
   ```
2. Copy your `.pdf` files into it:
   ```bash
   cp "/path/to/your-book.pdf" private/books/
   ```
3. Open **/books** in the app. Each PDF is listed by its file name; click one to read it in an
   embedded viewer (or "Open in new tab" for the browser's full PDF reader).

Notes:
- Only files ending in `.pdf` are shown; the file name (without `.pdf`) becomes the title.
- Point the app at a different folder with `EASYIELTS_BOOKS_DIR`.
- Nothing in `private/` is committed — see the repository `.gitignore`.
