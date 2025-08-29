import Papa from "papaparse";

export const parseCsvFile = async (filePath) => {
  const response = await fetch(filePath);
  const csvText = await response.text();

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
