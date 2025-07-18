import React from 'react';
import { ArrowRight, ShieldCheck, Server, Network } from 'lucide-react';
import ImageSlider from './ImageSlider';

const Hero: React.FC = () => {
  return (
    <div className="relative h-[600px] bg-gray-900">
      <ImageSlider />
      <div className="absolute inset-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl mb-6">
              Enterprise IT Infrastructure Solutions
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Premium networking equipment, security solutions, and server infrastructure from industry leaders.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="flex items-center space-x-2 text-white">
                <ShieldCheck className="h-6 w-6 text-blue-400" />
                <span>Network Security</span>
              </div>
              <div className="flex items-center space-x-2 text-white">
                <Server className="h-6 w-6 text-blue-400" />
                <span>Enterprise Servers</span>
              </div>
              <div className="flex items-center space-x-2 text-white">
                <Network className="h-6 w-6 text-blue-400" />
                <span>Network Equipment</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <a
                href="#products"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Explore Products
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a
                href="#contact"
                className="inline-flex items-center justify-center px-6 py-3 border border-white text-base font-medium rounded-md text-white hover:bg-white hover:text-gray-900 transition-colors"
              >
                Request Quote
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;