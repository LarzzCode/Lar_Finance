import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();
  
  // Helper untuk class active
  const linkClass = (path) => {
    const base = "px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200";
    return location.pathname === path 
      ? `${base} bg-orange-50 text-orange-600` 
      : `${base} text-gray-600 hover:text-gray-900 hover:bg-gray-50`;
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-orange-600 tracking-tight">
              LarFinance
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className={linkClass('/')}>Input Data</Link>
            <Link to="/rekapan" className={linkClass('/rekapan')}>Rekapan</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}