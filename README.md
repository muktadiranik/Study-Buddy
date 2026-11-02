# AI Study Buddy

A personal study workspace that turns your notes into summaries, flashcards, and practice quizzes. The frontend uses **React, TypeScript, Vite, and Tailwind CSS**. The backend uses **Python and FastAPI**. There are no accounts or cloud storage.

## Start here

You need Node.js 22.12 or later and Python 3.12–3.14. Python 3.13 was used for verification. Run all commands from this project folder.

### 1. Install dependencies

```powershell
npm install
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

If your default Python is 3.15, use an installed Python 3.13 instead. With the optional `uv` tool, the equivalent Python setup is:

```powershell
uv venv --python 3.13 .venv
uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt
```

The dependencies have already been installed in this checkout. You can go straight to running the app here.

### 2. Run the Python server

In your first terminal:

```powershell
.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Leave that terminal open. This server handles AI requests and local PDF/image import; it keeps the API key away from the browser.

### 3. Run the frontend

In a second terminal, from the same folder:

```powershell
npm run dev
```

Open **http://127.0.0.1:5173** in your browser. Vite forwards `/api` requests to the Python server on port 8000. Use `Ctrl+C` in each terminal to stop it.

On macOS or Linux, replace `.venv\Scripts\python.exe` with `.venv/bin/python`.

## Import a PDF or image with OCR

Select **New study set** (or **Edit notes**), then **Import PDF** or **Import image**. Choose your file to display an editable text preview. **Local OCR** is the default: recognition runs on your Python server without an API key or a paid OCR service. For difficult handwritten English, you can explicitly choose **Handwriting vision — OpenAI** and allow the selected page images to be sent to OpenAI for transcription.

- Uploads can be up to **10 MB**, with at most **200 pages** in a document.
- Import up to **20 PDF pages** at a time, including at most **5 pages requiring OCR**. Use **Start page** and **End page** to select a chapter or section, then choose **Extract pages**. Leaving End page blank selects through the last page, subject to these limits. Larger selections are rejected with guidance rather than silently dropping pages.
- **Automatic: text, then OCR** keeps selectable PDF text and recognizes pages with no text layer. For a bad or incomplete text layer (for example, a scanned page with only a selectable page number), choose **Always OCR**. **Text only** disables recognition. The preview lists which PDF pages used OCR, including any blank pages that were checked.
- Images can be **PNG, JPEG, or WebP**, up to **10 MB and 20 megapixels**, one still image per import. Camera orientation metadata is applied automatically. For sideways text, select **Rotate image clockwise**, then **Read image**. HEIC, TIFF, animations, and multiple images in one import are not supported; export individual PNGs or JPEGs first.
- **Improve phone photo** is enabled by default. It conservatively finds a complete sheet of paper, corrects perspective, reduces broad shadows, and straightens tilted text. It keeps grayscale pen strokes rather than converting everything to hard black and white. A small or soft image produces a retake suggestion. If preparation trims important content or loses detail, turn it off and read again. These heuristics cannot recover text lost to severe blur, glare, folds, or a cropped photo.
- For an angled photo or an open notebook, enable **Select one page to crop and straighten** after choosing an image. Select each corner in the menu and tap its position on the photo, clockwise around one written page. You can also enter X/Y percentages with the keyboard. **Reset corners** restores the full photo. Choose **Read image** to transcribe only that outlined area. Check that every line lies inside the corners; handwritten pages can curve, so correction is approximate. The separate rotation menu is disabled while corner selection is active. The original file is kept intact.
- For handwriting: choose **Handwriting vision — OpenAI**, select your file, check the permission checkbox, then choose **Read image** / **Extract pages**. This mode requires the server's `OPENAI_API_KEY`, internet access, and a model supporting image input and Structured Outputs. API charges may apply. Every newly selected file requires fresh permission; switching methods never silently sends a file. Up to five selected OCR page images go in one provider request. For a PDF containing an incomplete text layer, choose **Always OCR** to transcribe the scans. Native text pages in Automatic mode remain local.
- Vision transcription preserves wording and uses `[unclear]` for unreadable content. It is instructed to treat commands written in the notes as source text, never instructions. Responses are validated for structure and exact source-page identities before they appear. It can still guess or misread text: manually replace `[unclear]` and check the whole preview, especially numbers and formulas. No accuracy percentage or handwriting guarantee is claimed.
- Review the text before applying it. Extraction order, tables, formulas, columns, and unusual fonts may need manual corrections. Page labels such as `[PDF page 2]` remain in the notes, so generated paragraph references can be traced to the PDF page.
- The preview is separate from your current notes. **Use extracted text** or **Replace notes with PDF/image text** applies it to the editor; **Discard PDF/image preview** preserves existing notes. Correct the recognized text first, then save the study set. Importing into existing generated notes marks their materials outdated after saving, just like a manual notes edit. Image text is labeled `[Image OCR]`; scanned PDF text retains labels such as `[PDF page 2] (OCR)`.
- Notes are limited to **20,000 characters per set**. A longer preview is not silently truncated: shorten it in the preview or choose fewer pages. The extraction preview itself has a 100,000-character limit.
- **English is the tested priority.** Local OCR works best on clear printed notes. Handwriting, blur, shadows, perspective, columns, tables, equations, and unusual fonts may produce errors or omit text in either mode. Local OCR adds a warning for low recognition confidence; that confidence concerns recognition, not factual correctness. Vision output uses uncertainty markers instead of a numerical confidence score. The Read button is disabled while a preview is available, so repeated clicks reuse the preview rather than creating another provider call; change a setting or file to request a new extraction.
- Pages without readable text are reported. Password-protected, damaged, oversized, or unusually complex PDFs produce helpful errors. OCR-enabled workers have a **90-second processing limit**; text-only workers have 20 seconds. **Cancel extraction** stops waiting and discards the result. A running server worker may finish in the background, within its time limit. At most two imports run at once.

Original PDFs and images are not saved in the browser or on the server. Only extracted notes are saved when you save the set, and those notes are included in your backups. Local OCR makes no provider request. Handwriting vision sends in-memory JPEG copies of only the image or selected OCR PDF pages after permission; other PDF pages and the original PDF container are not uploaded to the provider. Requests use `store=False`, which does not itself guarantee zero provider retention. Selecting **Generate study materials** later separately sends the saved notes to OpenAI under the existing generation flow.

To configure a separate vision model, add this optional variable to your existing `.env` and restart Python:

```dotenv
# Leave blank to reuse OPENAI_MODEL. Choose a model your account can access.
OPENAI_OCR_MODEL=
# auto selects original detail for verified GPT-5.4/mini/nano variants;
# other models use high. You can explicitly choose high or original.
OPENAI_OCR_IMAGE_DETAIL=auto
```

The chosen model must support images and Structured Outputs. This integration follows the official OpenAI documentation for [vision image inputs](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses) and [validated structured responses](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). No API key or model setting is sent to browser code, and local OCR remains available without either setting.

Original-detail vision keeps colour and up to 8 million pixels, with a 3,600-pixel longest side, to retain small handwriting. It uses more image tokens than the previous high-detail mode. Local OCR keeps its 2,400-pixel limit. `OPENAI_OCR_IMAGE_DETAIL=high` offers the earlier sizing/cost tradeoff; `original` requires a compatible model. For an unrecognized model name, auto conservatively uses high. No automatic paid retries or model upgrades happen. Model settings in the existing `.env` were preserved during the real-photo evaluation; stronger models were tested only in temporary test processes.

The parser uses [`pypdf`](https://pypdf.readthedocs.io/en/stable/user/extract-text.html), [PDFium through pypdfium2](https://pypdfium2.readthedocs.io/en/stable/python_api.html) to render scans, and [RapidOCR](https://rapidai.github.io/RapidOCRDocs/install_usage/rapidocr/usage/) with ONNX Runtime for CPU recognition. The RapidOCR Python wheel includes the model files; imports use these local paths without downloading models at runtime. Installing the dependencies requires internet access and adds native CPU libraries. On an existing installation, update dependencies and restart the server:

```powershell
uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt
```

If you use pip instead of uv, use `.venv\Scripts\python.exe -m pip install -r requirements-dev.txt`.

## Backup, folders, tags, and scheduled reviews

Select **Backup / restore** in the sidebar to download a JSON backup. It includes notes, folders, tags, generated materials, card ratings, review dates, quiz drafts, and history. Server settings, including your API key, are excluded. Backup files contain your study content as readable text; choose where to keep them.

To restore, choose a backup file and inspect the preview. **Merge** adds missing sets and folders while preserving existing sets with the same ID, including their edits and progress. **Replace** uses exactly the backed-up library and requires an explicit confirmation checkbox. Invalid files, unsupported backup versions, broken folder references, and libraries exceeding the limits are rejected before anything changes. If browser storage cannot save a restore, the current library remains unchanged. Files must be smaller than 20 MB. An unreadable browser library can be recovered with a valid backup using confirmed replacement.

Select **Folders** to create, rename, or remove folders. Removing a folder moves its sets to **Unfiled**, keeping their notes and progress. Use **Edit notes** to assign a set to a folder and enter up to 10 comma-separated tags, each at most 24 characters. Editor tags are trimmed, lowercased, and deduplicated. Search matches titles, subjects, folder names, and tags. Folder and tag filters combine with search and **Due cards only**; **Clear filters** resets the view.

In **Flashcards**, **Study due cards** selects new cards and those whose review time has arrived. After successful due reviews, **Got it** schedules intervals of 1, 3, 7, 14, 30, 60, 120, 180, and then 365 days. **Review again** resets the interval and makes the card due in 10 minutes. Extra early correct practice does not advance an already scheduled card through several intervals. You can still study all cards or manually revisit cards marked for review whenever you want.

The due-card count and **Progress** show your scheduled work. Dates are stored as UTC timestamps and displayed in your browser's local timezone. One interval day means 24 hours. Due counts refresh about every 30 seconds while the app is open; there are no background notifications. Older records gain empty folder/tag/schedule fields without changing their notes, ratings, or quiz history. Previously rated cards with no schedule start as due; their next actual review starts scheduling. Editing organization alone preserves schedules. Outdated materials are excluded from due counts; generating replacement materials resets their card schedule because the cards may change.

## The 520-set example library

This version adds **520 worked-example study sets** across Algebra, Geometry, Arithmetic, Statistics, Physics, Chemistry, Computer Science, and Economics. There are 26 topics with 20 different numerical examples each. Together with the original Biology sample, a fresh library contains **521 study sets**.

Open or refresh the rebuilt app to load them. An existing browser library receives the examples once, while keeping its own notes, saved AI results, and progress. Stable seed IDs prevent duplicates. A saved seed-version marker ensures that examples you delete stay deleted. All seed sets are labeled **Example set** and contain notes only, with no fabricated AI outputs, scores, or card ratings.

Use the library search to find a subject or topic, such as `Physics`, `linear equations`, or `binary`. The sidebar initially shows 40 sets; **Show more study sets** loads another 40. Your own sets appear ahead of examples, and the selected set stays visible. You can edit, delete, and generate AI materials for example notes just like your own notes.

The app continues to use browser storage; it has no server-side database. The checked-in dataset is `src/data/study-sets.json`. Regenerate it without an API key or network access using:

```powershell
.venv\Scripts\python.exe scripts/seed_library.py
npm run build
```

The Python script uses explicit classroom formulas and deterministic inputs, so regenerating the file produces the same 520 IDs and worked examples. It does not reset the library or overwrite changes already saved in your browser. The notes are synthetic classroom examples, not records from real students.

## Enable AI generation

The app opens and lets you create, import, edit, and delete notes without a key. It does not substitute fake AI content.

1. Copy `.env.example` to `.env` in this folder:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Open `.env` in your editor and replace the placeholder:

   ```dotenv
   OPENAI_API_KEY=your_actual_key_goes_here
   OPENAI_MODEL=gpt-4.1-mini
   ```

3. Restart the Python server and refresh the page. Environment-file changes do not always trigger a reload.

Use a model available to your API account that supports Structured Outputs. The model is configurable; the example is a starting choice, not a claim about the newest model. OpenAI API access and billing are separate from this app. Never paste the key into notes or a frontend file. `.env` is ignored by Git, and neither variable uses a `VITE_` prefix. Vite must never receive your secret as a public environment variable.

The integration follows the official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses): the Python SDK calls `responses.parse` with a Pydantic model. The server validates the parsed result again, including source references and quiz semantics, before returning it.

## Try the complete flow

1. Open the included **The science of photosynthesis** sample, or select **New study set**.
2. Add a title, subject, and notes, or use **Import PDF** / **Import image** to extract and preview study material. **Import .txt** reads a plain UTF-8 text file into the editor. Saving commits the editor's changes. Use blank lines to separate note paragraphs.
3. Select **Generate study materials**. The selected notes, title, and subject are sent to OpenAI. The interface explains this before generation.
4. Read **Summary**. Select a numbered source label such as `[1]` to check the original paragraph.
5. Open **Flashcards**, reveal an answer, and choose **Got it** or **Review again**. Start a review session to revisit only the cards you marked.
6. Open **Quiz**, choose an answer for every question, and submit. Correct answers remain hidden until submission. Wrong answers include a concept explanation and a clearly labeled illustrative example. **Retry missed questions** practices only your mistakes.
7. Open **Progress** for scores, quiz history, and card mastery. Refresh the page: your notes, ratings, quiz drafts, and history remain.

## Where your data lives

- Everything is stored in this browser's `localStorage`, under `ai-study-buddy:v1`: notes, folders, tags, generated materials, card ratings, review schedules, unfinished quiz answers, and up to 100 recent quiz attempts per set.
- Nothing is synchronized between devices or browsers. Clearing site data removes it. Private browsing may clear it when the session ends. Keep a separate copy of important notes.
- Storage belongs to an exact browser origin. `localhost` and `127.0.0.1`, and different ports, have separate data. Keep using the same address.
- An unreadable saved record is left untouched. The app warns you and uses a temporary session. Full or blocked browser storage also produces a visible warning.
- The original sample and 520 example sets contain **notes only**. No generated answers or invented activity are seeded. The storage record includes a `seedVersion` marker to prevent repeating the one-time import.
- The Python server does not write notes, outputs, or keys to disk. It keeps at most 32 successful generations in memory for one hour to reduce duplicate provider requests. This cache disappears when the server stops. Calls use `store=False`; this is not a claim that the provider has no retention. See OpenAI's data policies before submitting sensitive notes.

## How generation and progress work

One request generates all study formats, with a maximum of 10 flashcards and 5 multiple-choice questions. Short notes should produce fewer questions. If there is insufficient factual material, the AI must say what is missing and return no study items. Notes are treated as untrusted source material, including any instructions embedded in them.

Blank lines define paragraphs. The same numbering rule is used in Python and TypeScript. Every generated factual item must cite an existing paragraph. Additional illustrative examples are labeled as teaching aids rather than sourced facts.

The browser reuses saved results across tabs and refreshes. Editing notes marks the existing materials outdated and disables practice until you update them. Existing quiz history remains, labeled as earlier notes. Updating materials resets card ratings and unfinished quiz answers because the questions may change. Title/subject-only edits preserve materials and progress.

Card mastery is the fraction of current cards marked **Got it**. Unrated cards are not counted as mastered or as cards explicitly needing review. Quiz scores are calculated from actual selected answers. The workspace average uses the last five completed attempts across all sets, including retries; the set's latest full quiz is shown separately. A retry never replaces a previous full-quiz score. No activity means no score, shown as `—`.

## Understand the code

| File                          | Responsibility                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `backend/main.py`             | FastAPI endpoints, request limits, configuration status, and helpful errors       |
| `backend/ai.py`               | OpenAI prompt, structured response call, timeout configuration, and bounded cache |
| `backend/models.py`           | Pydantic request/output schemas, citation checks, and quiz validation             |
| `src/App.tsx`                 | Study library, workspace tabs, editing, and generation orchestration              |
| `src/components/Dialogs.tsx`  | Note editor, text import, setup guide, and source reader                          |
| `src/components/Practice.tsx` | Flashcard sessions, quiz questions/results, retries, and progress                 |
| `src/lib/models.ts`           | TypeScript types and browser-side data validation                                 |
| `src/lib/storage.ts`          | Safe browser persistence                                                          |
| `src/lib/backup.ts`           | Versioned backup validation, serialization, and safe merge/replacement            |
| `src/lib/organization.ts`     | Folder-name/tag validation and combined library filters                           |
| `src/lib/repetition.ts`       | Deterministic review intervals and due-card selection                             |
| `src/lib/study.ts`            | Pure scoring, review selection, and progress helpers                              |
| `src/lib/seeds.ts`            | One-time example import with stable IDs that preserves existing work              |
| `scripts/seed_library.py`     | Reproducible generator for the 520 worked-example sets                            |
| `src/data/study-sets.json`    | Generated classroom note dataset, bundled separately from application code        |
| `src/styles.css`              | Responsive layout, color palette, and focus styles, with Tailwind loaded          |

The PDF/image import flow lives in `src/components/PdfImport.tsx` (upload, method selection, permission, and preview), `src/lib/pdf.ts` (client validation), `backend/pdf_import.py` (extraction and limits), `backend/ocr.py` (recognition routing and PDF rendering), `backend/photo.py` (conservative photo preparation), `backend/vision_ocr.py` (opt-in structured handwriting transcription), and `backend/pdf_worker.py` (the short-lived import process). Uploaded bytes travel through memory rather than temporary files. PDFium and OCR run in the isolated worker, with bounded image sizes and CPU thread counts. Photo transformations use [OpenCV's geometric transforms](https://docs.opencv.org/4.x/da/d54/group__imgproc__transform.html).

`src/components/PageCrop.tsx` provides the tap/keyboard page selection; `backend/crop.py` validates and rectifies it before recognition. Invalid, crossed, tiny, or out-of-bounds selections are rejected before a provider call. Source photos are limited to the existing 10 MB / 20 megapixel limits; rectified images have an 8 megapixel / 3,600-pixel cap.

For a first change, edit the sample notes in `src/lib/sample.ts`, or try adding a small piece of progress information using the helpers in `src/lib/study.ts`. Existing browser data will keep its saved sample until you delete that set or use a fresh browser profile.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
.venv\Scripts\python.exe -m ruff check backend scripts
.venv\Scripts\python.exe -m pytest -q
```

Browser checks use an isolated Chrome test profile. Start both local servers first, then run:

```powershell
npm run test:e2e
```

The Playwright configuration uses installed Google Chrome. If you use another browser, change `channel` in `playwright.config.ts` or install Playwright's Chromium and remove that setting. Tests cover desktop and mobile viewport sizes, note CRUD, `.txt` import, PDF upload/preview/ranges/errors, scanned/mixed PDF OCR, image OCR, preview corrections, refresh persistence, keyboard tab navigation, source references, card review, quiz drafts, missed-question retries, stale materials, and invalid/insufficient AI responses. Axe checks selected screens for WCAG A/AA accessibility issues. Screenshots are written to ignored `.qa/`. Global test setup generates synthetic PDF/image fixtures there using the project virtual environment; set `PYTHON_BIN` if your Python executable is elsewhere.

**Routine verification boundaries:** browser tests check the real local Python backend and its real PDF/OCR workers, including a synthetic photo with perspective distortion, uneven lighting, and JPEG compression. Python checks use real recognition on synthetic printed English PNG/JPEG/WebP notes, camera orientation, tilted text, faint strokes, scanned PDFs, and mixed native/scanned PDFs. The camera effects are artificial, not a benchmark of real handwriting or physical phone cameras. Python limit/error tests use mocks where appropriate. Vision tests mock the OpenAI SDK to check source matching, strict schemas, uncertainty, selected-page batching, model configuration, timeouts, and redacted provider errors. Browser permission/uncertainty cases mock vision responses and verify that choosing a file cannot trigger an unapproved upload. Browser PDF cancellation/malformed responses and the image rotation request-contract check are also mocked. AI configuration and generation are mocked so your local API key is never used by these routine checks.

**Separate real API check, November 2, 2026:** the configured `gpt-5.4-mini` model successfully transcribed synthetic handwriting-style images through the actual FastAPI upload routes and isolated workers. A clear cursive image preserved all seven expected lines, numbers/units, an intentionally incorrect calculation, and a command embedded in the notes as plain source text. A selected-page PDF check preserved all five expected phone-photo lines, reported the blank page, marked a covered word `[unclear]`, and excluded the unselected page. The final successful requests took about four and seven seconds respectively; timings vary. These are controlled font-based samples with artificial camera effects, not a measured accuracy score for real human handwriting or physical phone cameras. Those still require testing with your own notes.

The live test found that the original batch request could return only the last image. The fix adds a manifest of every source page, non-imperative image captions, and a response schema requiring exactly the requested number of entries. Local validation still rejects missing, duplicate, or incorrect source pages. Regression tests cover this case. Blank skipped pages no longer cause misleading blurry-photo advice for the other pages.

To repeat these **billable, opt-in** checks with your configured server key and model:

```powershell
# Prepare synthetic test files only; no OpenAI calls.
.venv\Scripts\python.exe -m scripts.check_live_ocr --prepare-only

# Makes two provider requests: one image, then a batch of selected PDF page images.
.venv\Scripts\python.exe -m scripts.check_live_ocr --allow-api
```

Use `--case clear` or `--case pdf` to make only one request. The default fixture font is Windows Segoe Print. To exercise cursive text, add `--font C:/Windows/Fonts/segoesc.ttf`; on other systems, supply a path to an installed handwriting-style TrueType font with `--font`. Fonts are not bundled. The script uploads only its synthetic fixtures, never your study library, and uses the same server key/model settings as the app. Results and fixture previews go in ignored `.qa/live-handwriting/`; credentials and provider exception details are not written there. Neither `pytest` nor the browser suite runs this script automatically, and running it without `--allow-api` or `--prepare-only` exits before doing work.

### Real handwritten notebooks and a real phone photograph

On November 2, 2026, separate billable checks used two unchanged, publicly licensed original photographs of human handwriting, not rendered fonts or simulated camera effects:

- Lewis Ronald's [open lecture notebook](https://commons.wikimedia.org/wiki/File:Notebook_with_english_handwriting.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- Phil Slattery's [low-light notebook photograph](https://commons.wikimedia.org/wiki/File:Notebook_with_pen,_August,_2019.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Its original EXIF identifies an LG Electronics LM-X210APM / LG Phoenix 4 phone. This phone provenance was verified rather than inferred from the appearance of the image.

The original hashes, dimensions, attribution, page corners, and manually read reference phrases are in `tests/fixtures/real-ocr-samples.json`. Three clearer lecture phrases and two clearer phone-photo references were checked, ignoring punctuation/case/spacing but preserving the written letters and digits. Ambiguous names and obscured text were not scored. One initially considered phrase in each source was excluded under closer inspection, from both the baseline and later comparisons. These checks measure selected phrase recovery, **not** full-page word error rate or an overall accuracy percentage.

| Live configuration                                        | Lecture notebook, selected phrases | LG phone photo, selected phrases |
| --------------------------------------------------------- | ---------------------------------- | -------------------------------- |
| Original mini-model pipeline                              | 0 / 3                              | 0 / 2                            |
| Higher resolution/detail, whole photo, mini model         | 2 / 3                              | 0 / 2                            |
| Higher resolution/detail, whole photo, GPT-5.4 comparison | 2 / 3                              | 0 / 2                            |
| Page-corner correction, mini model                        | 3 / 3 across two page selections   | 0 / 2                            |
| GPT-5.4 comparison on the selected phone page             | Not tested                         | 0 / 2                            |

The checks exposed omitted physical pages, lost small-letter detail, and confident wrong substitutions. The changes preserve more source detail/colour, explicitly request all written regions, and let the student isolate and rectify a page. They recovered the verified lecture phrases. **The blurry LG photo still has recognition errors:** neither tested model reliably recovered its selected phrases, even after page correction. It needs a clearer retake or manual transcription. A larger model was not configured as the default because it did not resolve this case. A high number of `[unclear]` markers now produces stronger retake guidance, including a warning that unmarked words can also be wrong. No reference text is supplied to the provider or used to patch its answers.

To reproduce the real-photo checks (downloads and paid calls are separate):

```powershell
# Downloads the attributed originals to ignored .qa/ and verifies their SHA-256 hashes.
.venv\Scripts\python.exe -m scripts.check_real_ocr --download

# Two billable requests for the unchanged full photos.
.venv\Scripts\python.exe -m scripts.check_real_ocr --allow-api

# Three billable requests, using the manually selected page corners in the manifest.
.venv\Scripts\python.exe -m scripts.check_real_ocr --allow-api --focus-regions
```

Use `--sample english-notebook` or `--sample lg-notebook` to limit calls. `--score-only` reads cached results without calling OpenAI. `--label baseline` scores or saves a separate baseline. The real-photo script deliberately exits with a nonzero code when checked phrases are missing, even if HTTP succeeded; the LG case is a known failing accuracy case, not a passing benchmark. Scripts never run automatically in the routine test suite. Original photos, crops, and provider transcriptions stay under ignored `.qa/real-handwriting/`; no real photos are shipped with the app. Crops/transcriptions derived from each source retain its attribution and ShareAlike terms; the original images are unchanged. Your own library and private notes are not uploaded by these evaluation scripts.

## Run the built app with only Python

```powershell
npm run build
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

After building, restart Python so it detects `dist/`. Open **http://127.0.0.1:8000**. This address has separate browser storage from the development address on port 5173. You do not need a Node development server in this mode.

## Limits of this first version

- Personal local use only. No authentication, public deployment hardening, or cloud synchronization. The servers bind to loopback by default.
- At most 1,000 study sets and 20,000 note characters per set. Text import/generation requests have a 100 KB limit; PDF/image uploads have a separate 10 MB limit. Browser storage quotas may impose a smaller practical limit. The example library initially uses roughly 1 MiB of browser storage; generated materials and practice history use additional space.
- Pasted notes, plain UTF-8 `.txt`, native/scanned PDFs, and PNG/JPEG/WebP images are supported. OCR is best-effort text recognition, not a visual reproduction or a promise of handwriting accuracy. Voice, payments, and cloud features are deferred.
- An AI can still misunderstand notes, copy an error in the source, or produce a weak question. Validation checks structure and valid reference numbers; it cannot prove factual correctness. Check the linked source paragraphs.
- Generation times out after roughly one minute. Provider requests are not automatically retried. A browser losing its connection after a request starts cannot guarantee cancellation of the provider's work.
- No automatic/cloud backups or multi-tab merge mechanism. Download backups regularly and avoid editing the same library in multiple tabs simultaneously.
- Automated browser checks emulate a phone viewport; they are not tests on physical phone hardware.
- The dependency audit currently reports moderate advisories in the development lint toolchain through `minimatch`. The installed dependency tree has no compatible automatic fix. These tools are not shipped to the browser; check advisories when updating dependencies.
