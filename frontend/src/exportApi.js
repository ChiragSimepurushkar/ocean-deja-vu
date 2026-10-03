export const EXPORT_DATA = async (date, params) => {
  // Construct the URL safely
  const url = new URL(`http://localhost:8000/export/${date}`);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }

    // Parse filename from Content-Disposition header if available
    let filename = `ocean_export_${date}.csv`;
    const disposition = response.headers.get('Content-Disposition');
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) { 
        filename = matches[1].replace(/['"]/g, '');
      }
    }

    // Trigger download
    const blob = await response.blob();
    const windowUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = windowUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(windowUrl);

    return true;
  } catch (error) {
    console.error("Export Error:", error);
    throw error;
  }
};
