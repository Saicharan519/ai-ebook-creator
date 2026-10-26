import React from 'react'
import { Star, Quote } from 'lucide-react'
import { TESTIMONIALS } from '../../utils/data'

const Testimonials = () => {
  return (
    <div id='testimonials' className="relative py-24 lg:py-32 bg-gradient-to-br from-violet-50 via-purple-50 to-white overflow-hidden">
      
      {/* Decorative Elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-violet-200/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        
        {/* Header */}
        <div className="text-center mb-20 space-y-5">
          <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-violet-200 shadow-sm">
            <Star className="w-4 h-4 text-violet-600 fill-violet-600 " />

            <span className="text-sm font-semibold text-violet-900">Testimonials</span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
            Loved by Creators
            <span className=" block mt-2 bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
              Everywhere
            </span>
          </h2>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Don't just take our word for it. Here's what our users have to say about their experience with our AI-powered ebook creator.
          </p>
        </div>
        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, index) => (
                <div
                 key={index}
                  className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-8  border border-gray-200 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300 hover:-translate-y-1">
                    {/*quote icon*/}
                    <div className="absolute top-4 left-4 w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:rotate-12 transition-transform duration-300">
                        <Quote className=" w-5 h-5 text-white" />
                    </div>
                    {/*Rating stars*/}
                    <div className="flex items-center space-x-1 mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i}
                             className="w-5 h-5 text-violet-600 fill-violet-600"
                              />
                        ))}
                    </div>
                    {/*Quote */}
                    <p className=" text-gray-600 mb-6 leading-relaxed text-base">
                        {testimonial.quote}
                    </p>    
                    {/*Author Info */}
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full opacity-75"></div>
                            <img 
                             className="relative w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-lg"
                                src={testimonial.avatar}
                                alt={testimonial.author}
                                />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-base"> {testimonial.author} </p>
                            <p className="text-gray-600 text-sm"> {testimonial.title} </p>
                        </div>
                    </div>
                    {/*Hover Gradient background*/}
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 to-purple-50/0 group-hover:from-violet-50/50 group-hover:to-purple-50/30 rounded-3xl transition-all duration-300 -z-10"></div>
                </div>
            ))}
        </div>
        {/* Bottom status */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
                <div className="text-3xl font-bold text-violet-600 mb-2">50k+</div>
                <div className="text-gray-600">Happy Creators</div>
            </div>
            <div className="text-center">
                <div className="text-4xl font-bold text-gray-600 mb-2">4.9/5</div>
                <div className="text-gray-600">Average Rating</div>
            </div>
            <div className="text-center">
                <div className="text-4xl font-bold text-gray-600 mb-2">100k+</div>
                <div className="text-gray-600">Ebooks Created</div>
            </div>
        </div>

      </div>
    </div>
  )
}

export default Testimonials