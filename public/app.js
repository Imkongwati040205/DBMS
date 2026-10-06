const form = document.querySelector("#upload-form");
const message = document.querySelector("#message");
const list = document.querySelector("#document-list");

async function loadDocuments() {
  const response = await fetch("/api/documents");

  if (!response.ok) {
    throw new Error("Could not load documents.");
  }

  const documents = await response.json();
  list.replaceChildren();

  if (documents.length === 0) {
    message.textContent = "No documents uploaded yet.";
    return;
  }

  message.textContent = "";

  for (const doc of documents) {
    const item = document.createElement("li");
    const sizeInKb = Math.round(doc.size / 1024);

    item.textContent = `${doc.original_name} — ${sizeInKb} KB `;

    const downloadLink = document.createElement("a");
    downloadLink.href = `/api/documents/${doc.id}/download`;
    downloadLink.textContent = "Download";
    item.appendChild(downloadLink);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(
        `Permanently delete "${doc.original_name}"?`
      );

      if (!confirmed) return;

      try {
        const deleteResponse = await fetch(`/api/documents/${doc.id}`, {
          method: "DELETE"
        });
        const result = await deleteResponse.json();

        if (!deleteResponse.ok) {
          message.textContent = "Delete failed: " + (result.error || "Unknown error.");
          return;
        }

        await loadDocuments();
        message.textContent = "Document deleted.";
      } catch (error) {
        message.textContent = "Request error: " + error.message;
      }
    });

    item.append(" ");
    item.appendChild(deleteButton);
    list.appendChild(item);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Uploading…";

  try {
    const response = await fetch("/api/documents", {
      method: "POST",
      body: new FormData(form)
    });
    const result = await response.json();

    if (!response.ok) {
      message.textContent = result.error || "Upload failed.";
      return;
    }

    form.reset();
    await loadDocuments();
    message.textContent = "Document uploaded.";
  } catch (error) {
    message.textContent = "Request error: " + error.message;
  }
});

loadDocuments().catch(() => {
  message.textContent = "Could not load documents.";
});