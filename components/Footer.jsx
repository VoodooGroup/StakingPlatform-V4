export default function Footer() {
  return (
    <footer className="bg-black text-white py-3 mt-auto">
      <div className="px-5 flex flex-col md:flex-row justify-between items-center">
        <p className="text-sm order-1 md:order-1">© 2026 Voodoo Token • All rights reserved</p>
        <div className="flex space-x-6 order-2 md:order-2">
          <a href="https://x.com/Voodoo_Token/" target="_blank" rel="noopener noreferrer" className="transition"><i className="fa fa-twitter" /></a>
          <a href="https://t.me/+oBoh-NebaWcxMDQ0" target="_blank" rel="noopener noreferrer" className="transition"><i className="fa fa-telegram" /></a>
          <a href="https://www.youtube.com/@Voodoo_Token" target="_blank" rel="noopener noreferrer" className="transition"><i className="fa fa-youtube-play" /></a>
        </div>
      </div>
    </footer>
  );
}