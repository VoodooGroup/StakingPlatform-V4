export default function CalculatorModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto relative p-6">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold">×</button>
        <h1 className="text-2xl font-bold mb-4 text-center text-white">Staking Calculator</h1>
        <img src="/Voodoo-Token-Logo.png" alt="Voodoo Token Logo" className="w-16 h-16 mx-auto mb-6" />
        <p className="text-gray-300 text-sm text-center">Use the live portal at /index.html for calculator with on-chain rates.</p>
      </div>
    </div>
  );
}