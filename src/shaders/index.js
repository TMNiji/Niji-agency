import heroGrainFragment from './hero_grain.glsl';
import prismFragment     from './prism.glsl';

const VERTEX = `void main() { gl_Position = vec4(position, 1.0); }`;

export const SHADER_PRESETS = {
  hero_grain: { vertex: VERTEX, fragment: heroGrainFragment },
  prism:      { vertex: VERTEX, fragment: prismFragment },
};
