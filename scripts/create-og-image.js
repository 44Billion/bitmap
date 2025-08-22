#!/usr/bin/env node

import sharp from 'sharp';

async function createOgImage() {
  try {
    console.log('Creating new og-image for Bitmap...');
    
    // Define dimensions for og-image (standard social media size)
    const width = 1200;
    const height = 630;
    
    // Define colors (using Bitmap brand colors - black and white)
    const backgroundColor = '#000000'; // black background
    
    // Create the background
    const background = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: backgroundColor
      }
    });
    
    // Load and resize the icon
    const iconSize = 400; // Prominent icon size
    const icon = await sharp('public/icon-512.svg')
      .resize(iconSize, iconSize)
      .png()
      .toBuffer();
    
    // Create text overlay using SVG
    const titleText = 'BITMAP';
    const subtitleText = 'Bitchat Heat Map';
    
    const textSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .title { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              font-size: 72px; 
              font-weight: 300; 
              fill: white;
              text-anchor: middle;
              letter-spacing: 8px;
            }
            .subtitle { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              font-size: 32px; 
              font-weight: 300; 
              fill: #cccccc;
              text-anchor: middle;
              letter-spacing: 2px;
            }
          </style>
        </defs>
        <text x="${width/2}" y="480" class="title">${titleText}</text>
        <text x="${width/2}" y="530" class="subtitle">${subtitleText}</text>
      </svg>
    `;
    
    // Composite everything together
    const result = await background
      .composite([
        {
          input: icon,
          top: Math.round((height - iconSize) / 2 - 120), // Position icon above text
          left: Math.round((width - iconSize) / 2),
        },
        {
          input: Buffer.from(textSvg),
          top: 0,
          left: 0,
        }
      ])
      .png()
      .toFile('public/og-image.png');
    
    console.log('✅ New og-image.png created successfully!');
    console.log(`📏 Dimensions: ${width}x${height}`);
    console.log(`📁 Size: ${Math.round(result.size / 1024)}KB`);
    
  } catch (error) {
    console.error('❌ Error creating og-image:', error);
    process.exit(1);
  }
}

createOgImage();