import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import InputData from './pages/InputData';
import Rekapan from './pages/Rekapan';
// IMPORT TOASTER
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#fcfcfc', minHeight: '100vh' }}>
      <Navbar />
      
      {/* PASANG WADAH NOTIFIKASI DISINI */}
      <Toaster position="top-center" reverseOrder={false} />

      <Routes>
        <Route path="/" element={<InputData />} />
        <Route path="/rekapan" element={<Rekapan />} />
      </Routes>
    </div>
  );
}

export default App;