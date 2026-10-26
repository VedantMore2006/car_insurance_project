import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Svg, {Path, Circle, Line, Rect} from 'react-native-svg';

interface CarSilhouetteGuideProps {
  visible?: boolean;
  strokeColor?: string;
  guideText?: string;
}

export default function CarSilhouetteGuide({
  visible = true,
  strokeColor = 'rgba(255, 255, 255, 0.65)',
  guideText = 'Align vehicle within the guide',
}: CarSilhouetteGuideProps) {
  if (!visible) {
    return null;
  }

  return (
    <View
      style={styles.container}
      pointerEvents="none"
      testID="car-silhouette-guide">
      {/* Top alignment instruction pill */}
      <View style={styles.pillContainer}>
        <Text style={styles.pillText}>{guideText}</Text>
      </View>

      {/* SVG Technical Silhouette of Vehicle Profile */}
      <View style={styles.svgWrapper}>
        <Svg
          viewBox="0 0 400 200"
          width="100%"
          height="100%"
          testID="car-silhouette-svg">
          {/* Corner Framing Brackets */}
          {/* Top-Left */}
          <Path
            d="M 15 35 L 15 15 L 35 15"
            stroke={strokeColor}
            strokeWidth="3"
            fill="none"
          />
          {/* Top-Right */}
          <Path
            d="M 365 15 L 385 15 L 385 35"
            stroke={strokeColor}
            strokeWidth="3"
            fill="none"
          />
          {/* Bottom-Left */}
          <Path
            d="M 15 165 L 15 185 L 35 185"
            stroke={strokeColor}
            strokeWidth="3"
            fill="none"
          />
          {/* Bottom-Right */}
          <Path
            d="M 365 185 L 385 185 L 385 165"
            stroke={strokeColor}
            strokeWidth="3"
            fill="none"
          />

          {/* Center Target Crosshairs */}
          <Line
            x1="185"
            y1="105"
            x2="215"
            y2="105"
            stroke="rgba(61, 139, 255, 0.8)"
            strokeWidth="2"
            strokeDasharray="3, 3"
          />
          <Line
            x1="200"
            y1="90"
            x2="200"
            y2="120"
            stroke="rgba(61, 139, 255, 0.8)"
            strokeWidth="2"
            strokeDasharray="3, 3"
          />
          <Circle
            cx="200"
            cy="105"
            r="12"
            stroke="rgba(61, 139, 255, 0.6)"
            strokeWidth="1.5"
            fill="none"
          />

          {/* Car Body Outer Shell (Side Profile Outline) */}
          <Path
            d="
              M 35 142
              L 25 142
              Q 15 140 18 128
              L 24 116
              Q 32 108 50 106
              L 115 100
              L 168 56
              Q 175 52 195 52
              L 265 52
              Q 282 52 295 62
              L 332 95
              L 375 102
              Q 388 105 388 118
              L 384 135
              Q 380 142 368 142
              L 325 142
              A 26 26 0 0 0 273 142
              L 137 142
              A 26 26 0 0 0 85 142
              L 35 142
              Z
            "
            stroke={strokeColor}
            strokeWidth="2.5"
            fill="none"
          />

          {/* Front Wheel & Rim */}
          <Circle
            cx="111"
            cy="142"
            r="22"
            stroke={strokeColor}
            strokeWidth="2.5"
            fill="rgba(0,0,0,0.2)"
          />
          <Circle
            cx="111"
            cy="142"
            r="12"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeDasharray="4, 2"
            fill="none"
          />
          <Circle cx="111" cy="142" r="4" fill={strokeColor} />

          {/* Rear Wheel & Rim */}
          <Circle
            cx="299"
            cy="142"
            r="22"
            stroke={strokeColor}
            strokeWidth="2.5"
            fill="rgba(0,0,0,0.2)"
          />
          <Circle
            cx="299"
            cy="142"
            r="12"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeDasharray="4, 2"
            fill="none"
          />
          <Circle cx="299" cy="142" r="4" fill={strokeColor} />

          {/* Window Frames */}
          {/* Front Side Window */}
          <Path
            d="M 172 60 L 210 60 L 210 98 L 125 98 L 168 62 Z"
            stroke={strokeColor}
            strokeWidth="1.5"
            fill="rgba(255, 255, 255, 0.05)"
          />
          {/* Rear Side Window */}
          <Path
            d="M 218 60 L 260 60 Q 272 60 282 68 L 318 98 L 218 98 Z"
            stroke={strokeColor}
            strokeWidth="1.5"
            fill="rgba(255, 255, 255, 0.05)"
          />

          {/* Door Cut Line */}
          <Line
            x1="214"
            y1="60"
            x2="214"
            y2="140"
            stroke={strokeColor}
            strokeWidth="1.5"
          />

          {/* Door Handles */}
          <Rect
            x="185"
            y="104"
            width="12"
            height="3"
            rx="1.5"
            fill={strokeColor}
          />
          <Rect
            x="240"
            y="104"
            width="12"
            height="3"
            rx="1.5"
            fill={strokeColor}
          />

          {/* Headlight & Taillight Accents */}
          <Path
            d="M 22 118 L 44 110 L 40 124 Z"
            stroke="rgba(61, 139, 255, 0.9)"
            strokeWidth="1.5"
            fill="rgba(61, 139, 255, 0.2)"
          />
          <Path
            d="M 384 115 L 368 115 L 370 126 L 382 125 Z"
            stroke="rgba(239, 68, 68, 0.9)"
            strokeWidth="1.5"
            fill="rgba(239, 68, 68, 0.2)"
          />
        </Svg>
      </View>

      {/* Subtle bottom guide prompt */}
      <Text style={styles.subPrompt}>Keep entire vehicle in frame</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  pillContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 16,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  svgWrapper: {
    width: '100%',
    maxWidth: 380,
    height: 190,
  },
  subPrompt: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 12,
    letterSpacing: 0.3,
  },
});
