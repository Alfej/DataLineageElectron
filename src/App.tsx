import React, { useEffect, useState } from "react";
import Graph from "./components/Graph";
import { parseCsvFile } from "./utils/parseCSV";

function App() {
  const [data, setData] = useState([]);

  useEffect(() => {
    parseCsvFile("data/data.csv").then((rows) => setData(rows));
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Graph data={data} />
    </div>
  );
}

export default App;
