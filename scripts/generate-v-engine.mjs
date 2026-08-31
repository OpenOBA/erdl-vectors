#!/usr/bin/env node
/*
 * Copyright 2026 Shenzhen Miaojing Technology Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * generate-v-engine.mjs — V-ENGINE 223-vector generator (depends on the @openoba/erdl reference engine)
 *
 * The generation logic (v-engine.mjs, migrated from the reference engine) builds expr_tree/context per vector, using @openoba/erdl
 * to evaluate and produce expected, serialized to v-engine-vectors.json.
 *
 * Writes via "temp file + rename atomic replace", avoiding concurrent readers seeing truncated output.
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
console.log(`V-ENGINE vectors generated: ${vectors.length} → ${outPath}`);
