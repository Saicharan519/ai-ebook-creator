import React from "react";
import { FEATURES as Feature } from "../../utils/data";

const Features = () => {
  return (
    <div
      id="features"
      className="relative py-24 lg:py-32 bg-white overflow-hidden"
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-50/50 via-transparent to-purple-50/50"></div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        {/* Header */}
        <div className="text-center mb-20 space-y-5">
          <div className="inline-flex items-center space-x-2 bg-violet-100 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-violet-500">
              Features
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
            Everything you need to
            <span className="block mt-2 bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
              create your Ebook
            </span>
          </h2>

          <p className="text-base text-gray-600 max-w-xl mx-auto">
            Our platform is packed with powerful features to help you write,
            design, and publish your ebook effortlessly.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {Feature.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div
                key={index}
                className="group relative bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:border-violet-200 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 to-purple-50/0 group-hover:from-violet-50/50 group-hover:to-purple-50/30 rounded-2xl transition-all duration-300"></div>

                <div className="relative space-y-4">
                  <div
                    className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300`}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-violet-900 transition-colors">
                      {feature.title}
                    </h3>

                    <p className="text-gray-600 leading-relaxed text-sm">
                      {feature.description}
                    </p>
                  </div>

                  <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-violet-500 text-sm font-medium inline-flex items-center">
                      Learn more
                      <svg
                        className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-6">Ready to get started?</p>

          <a
            href="/signup"
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300"
          >
            <span>Start Creating Today</span>

            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Features;