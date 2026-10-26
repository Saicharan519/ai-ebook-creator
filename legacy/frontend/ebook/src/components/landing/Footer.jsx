import { BookOpen } from "lucide-react";

const Footer = () => {
  return (
    <footer className="relative bg-gradient-to-br from-gray-950 via-gray-950">
      
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500 rounded-full">
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="py-16 grid grid-cols-1 md:grid-cols-12 gap-12">

          {/* Brand Section */}
          <div className="md:col-span-5 space-y-6">
            <a
              href="/"
              className="flex items-center space-x-2.5 group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/50  transition-all duration-300 group-hover:scale-110">
                <BookOpen className="w-6 h-6 text-white" />
              </div>

              <span className="text-xl font-bold tracking-tight">eBook Creator</span>
            </a>

            <p className="text-gray-600 leading-relaxed max-w-sm">
              Create, design, and publish stunning ebooks with the power of AI.
            </p>

            {/* Social Links */}
            <div className="flex items-center space-x-3 pt-2">
              <a
                href="https://twitter.com"
                className="w-10 h-10 bg-white/5 hover:bg-violet-600 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110 text-white font-bold"
                aria-label="Twitter"
              >
                Tw
              </a>

              <a
                href="https://linkedin.com"
                className="w-10 h-10 bg-white/5 hover:bg-violet-600 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110 text-white font-bold"
                aria-label="LinkedIn"
              >
                In
              </a>

              <a
                href="https://github.com"
                className="w-10 h-10 bg-white/5 hover:bg-violet-600 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110 text-white font-bold"
                aria-label="GitHub"
              >
                Gh
              </a>
            </div>
          </div>
          {/* Quick Links */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">   
                <div>
                    <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
                    <ul className="space-y-3">
                        <li>
                            <a href="#Features" className="text-gray-400 hover:text-violet-400 transition-colors duration-200 text-sm">
                                Features
                                </a>
                        </li>
                        <li>
                            <a href="#Pricing" className="text-gray-400 hover:text-violet-400 transition-colors duration-200 text-sm">
                                Pricing
                                </a>
                        </li>
                        <li>
                            <a href="#template" className="text-gray-400 hover:text-violet-400 transition-colors duration-200 text-sm">
                                Template
                                </a>
                        </li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-white mb-4">Company</h3>
                    <ul className="space-y-3">
                        <li>
                            <a href="#about" className="text-gray-400 hover:text-violet-400 transition-colors duration-200 text-sm">
                                About Us
                                </a>
                        </li>
                        <li>
                            <a href="#contact" className="text-gray-400 hover:text-violet-400 transition-colors duration-200 text-sm">
                                Contact
                                </a>
                        </li>
                        <li>
                            <a href="#blog" className="text-gray-400 hover:text-violet-400 transition-colors duration-200 text-sm">
                                Blog
                                </a>
                        </li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-white mb-4">Support</h3>
                    <ul className="space-y-3">
                        <li>
                            <a href="#privacy" className="text-gray-400 hover:text-violet-400 transition-colors duration-200 text-sm">
                                Privacy 
                                </a>
                        </li>
                        <li>
                            <a href="#terms" className="text-gray-400 hover:text-violet-400 transition-colors duration-200 text-sm">
                                Terms 
                                </a>
                        </li>
                        
                            </ul>

                </div>
                </div>
                </div>
                {/* Bottom Bar */}
                <div className="border-t border-white/10 py-8">
                    <div className="flex flex-col md:flex-row  justify-between items-center space-y-4 md:space-y-8">
                        <p className="text-gray-400 text-sm">
                            {new Date().getFullYear()} eBook Creator. All rights reserved.
                        </p>
                        <p className="text-gray-500 text-sm">
                            Made with  by AI Enthusiasts
                            <span className="text-violet-500"> ❤️</span>for creators
                        </p>
                        </div>    

        </div>
      </div>
    </footer>
  );
};

export default Footer;