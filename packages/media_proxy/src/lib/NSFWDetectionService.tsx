/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';

const MODEL_SIZE = 224;

interface NSFWCheckResult {
	isNSFW: boolean;
	probability: number;
	predictions?: {
		drawing: number;
		hentai: number;
		neutral: number;
		porn: number;
		sexy: number;
	};
}

export class NSFWDetectionService {
	private session: ort.InferenceSession | null = null;
	private readonly NSFW_THRESHOLD = 0.85;
	private modelPath: string;
	private readonly logger?: LoggerInterface | undefined;

	constructor(options?: {
		modelPath?: string | undefined;
		nodeEnv?: string | undefined;
		logger?: LoggerInterface | undefined;
	}) {
		const nodeEnv = options?.nodeEnv ?? 'production';
		this.logger = options?.logger;
		this.modelPath =
			options?.modelPath ??
			(nodeEnv === 'production' ? '/opt/data/model.onnx' : path.join(process.cwd(), 'data', 'model.onnx'));
	}

	async initialize(): Promise<void> {
		try {
			const modelBuffer = await fs.readFile(this.modelPath);
			this.session = await ort.InferenceSession.create(modelBuffer);
			this.logger?.info(`NSFW detection model loaded from ${this.modelPath}`);
		} catch (error) {
			// The NSFW model is optional. If it's missing or fails to load, run with
			// detection disabled instead of crashing the whole server — uploads simply
			// won't be auto-flagged until a model is provided at modelPath. (Self-hosters
			// can mount one there; see the self-host guide / GitHub issue #18.)
			this.session = null;
			this.logger?.warn(
				`NSFW detection model could not be loaded from ${this.modelPath} — NSFW detection is DISABLED. ` +
					'Uploads will not be automatically flagged. Provide a model at this path to enable it. ' +
					`(${error instanceof Error ? error.message : String(error)})`,
			);
		}
	}

	async checkNSFW(filePath: string): Promise<NSFWCheckResult> {
		const buffer = await fs.readFile(filePath);
		return this.checkNSFWBuffer(buffer);
	}

	async checkNSFWBuffer(buffer: Buffer): Promise<NSFWCheckResult> {
		if (!this.session) {
			// Detection disabled (no model loaded): treat as not-NSFW rather than
			// failing the upload. See initialize().
			return {isNSFW: false, probability: 0};
		}

		const processedImage = await this.preprocessImage(buffer);
		const tensor = new ort.Tensor('float32', processedImage, [1, MODEL_SIZE, MODEL_SIZE, 3]);

		const feeds = {input: tensor};
		const results = await this.session.run(feeds);

		const outputTensor = results['prediction'];
		if (!outputTensor || !outputTensor.data) {
			throw new Error('ONNX model output tensor data is undefined');
		}

		const predictions = Array.from(outputTensor.data as Float32Array);

		const drawing = predictions[0] ?? 0;
		const neutral = predictions[2] ?? 0;
		const porn = predictions[3] ?? 0;
		const sexy = predictions[4] ?? 0;

		const predictionMap = {
			drawing,
			// NOTE: hentai: predictions[1], gives false positives
			hentai: 0,
			neutral,
			porn,
			sexy,
		};

		const nsfwProbability = predictionMap.hentai + predictionMap.porn + predictionMap.sexy;

		return {
			isNSFW: nsfwProbability > this.NSFW_THRESHOLD,
			probability: nsfwProbability,
			predictions: predictionMap,
		};
	}

	private async preprocessImage(buffer: Buffer): Promise<Float32Array> {
		const imageBuffer = await sharp(buffer)
			.resize(MODEL_SIZE, MODEL_SIZE, {fit: 'fill'})
			.removeAlpha()
			.raw()
			.toBuffer();

		const float32Array = new Float32Array(MODEL_SIZE * MODEL_SIZE * 3);
		const mean = [104, 117, 123];

		for (let i = 0; i < imageBuffer.length; i += 3) {
			float32Array[i] = (imageBuffer[i + 2] ?? 0) - (mean[0] ?? 0);
			float32Array[i + 1] = (imageBuffer[i + 1] ?? 0) - (mean[1] ?? 0);
			float32Array[i + 2] = (imageBuffer[i] ?? 0) - (mean[2] ?? 0);
		}

		return float32Array;
	}
}
