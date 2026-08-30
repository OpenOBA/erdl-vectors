#!/usr/bin/env node
/**
 * generate-v-engine.mjs — V-ENGINE 223 条向量生成器（依赖 @openoba/erdl 参考引擎）
 *
 * 生成逻辑（v-engine.mjs，从参考引擎迁入）逐条构建 expr_tree/context，用 @openoba/erdl
 * 求值产出 expected，序列化为 v-engine-vectors.json。
 *
 * 写入走「临时文件 + rename 原子替换」，避免并发读者看到截断产物。
 */
import {
  generateAllVectors, generateNodeVectors, generateConstraintVectors, generateSimpleVectors,
  generateGlossVectors, generateGlossIntegrityVectors, generateProjVectors,
} from './v-engine.mjs';
import { writeFileSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';

const vectors = generateAllVectors();
const output = {
  $schema: 'https://openoba.com/erdl/v-engine-vectors-v2.0/schema.json',
  spec: 'erdl-spec-v2.0',
  vector_version: 'v2.0.0',
  category: 'V-ENGINE + V-GLOSS/V-PROJ',
  generated: '2026-08-22',
  maintainer: 'OpenOBA (https://openoba.com)',
  total: vectors.length,
  breakdown: {
    node: generateNodeVectors().length,
    constraint: generateConstraintVectors().length,
    simple_compile: generateSimpleVectors().length,
    gloss: generateGlossVectors().length,
    gloss_integrity: generateGlossIntegrityVectors().length,
    projection: generateProjVectors().length,
  },
  vectors,
};

const outPath = fileURLToPath(new URL('../v-engine-vectors.json', import.meta.url));
const serialized = JSON.stringify(output, null, 2);
const tmpPath = `${outPath}.tmp-${process.pid}`;
writeFileSync(tmpPath, serialized, 'utf8');
renameSync(tmpPath, outPath);
console.log(`V-ENGINE 向量已生成: ${vectors.length} 条 → ${outPath}`);
