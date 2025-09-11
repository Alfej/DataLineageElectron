import Papa from "papaparse";

export const parseCsvFile = async (fileOrPath: File | string) => {
  // If a File object is provided, read it; otherwise fetch the path
  const csvText = await (async () => {
    if (typeof fileOrPath === 'string') {
      const response = await fetch(fileOrPath);
      return await response.text();
    }
    return await fileOrPath.text();
  })();

  return new Promise((resolve) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
    });
  });
};
