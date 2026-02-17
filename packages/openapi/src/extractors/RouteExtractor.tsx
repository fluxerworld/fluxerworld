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

import type {ExtractedRoute, ExtractedValidator, HttpMethod, ValidatorTarget} from '@fluxer/openapi/src/Types';
import {type CallExpression, Node, Project, type SourceFile} from 'ts-morph';

const HTTP_METHODS: ReadonlySet<string> = new Set(['get', 'post', 'put', 'patch', 'delete']);

function isHttpMethod(method: string): method is HttpMethod {
	return HTTP_METHODS.has(method);
}

function isValidatorTarget(target: string): target is ValidatorTarget {
	return ['json', 'query', 'param', 'form', 'header', 'cookie'].includes(target);
}

function extractStringLiteral(node: Node): string | null {
	if (Node.isStringLiteral(node)) {
		return node.getLiteralValue();
	}
	if (Node.isNoSubstitutionTemplateLiteral(node)) {
		return node.getLiteralValue();
	}
	return null;
}

function extractNumberArray(value: unknown): Array<number> | null {
	if (typeof value === 'number') return [value];
	if (Array.isArray(value)) {
		const numbers = value.filter((v): v is number => typeof v === 'number');
		return numbers.length > 0 ? numbers : null;
	}
	return null;
}

function extractStringArray(value: unknown): Array<string> | null {
	if (typeof value === 'string') return [value];
	if (Array.isArray(value)) {
		const strings = value.filter((v): v is string => typeof v === 'string');
		return strings.length > 0 ? strings : null;
	}
	return null;
}

function extractOAuth2ScopeArgs(args: ReadonlyArray<Node>): Array<string> | null {
	const scopes: Array<string> = [];
	for (const arg of args) {
		const value = extractStringLiteral(arg);
		if (!value) {
			return null;
		}
		scopes.push(value);
	}

	return scopes.length > 0 ? scopes : null;
}

function extractObjectLiteralValue(node: Node): unknown {
	if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
		return node.getLiteralValue();
	}
	if (Node.isNumericLiteral(node)) {
		return Number.parseFloat(node.getText());
	}
	if (Node.isTrueLiteral(node)) {
		return true;
	}
	if (Node.isFalseLiteral(node)) {
		return false;
	}
	if (Node.isNullLiteral(node)) {
		return null;
	}
	if (Node.isIdentifier(node)) {
		return node.getText();
	}
	if (Node.isPropertyAccessExpression(node)) {
		return node.getText();
	}
	if (Node.isCallExpression(node)) {
		return node.getText();
	}
	if (Node.isArrayLiteralExpression(node)) {
		return node.getElements().map((el) => extractObjectLiteralValue(el));
	}
	if (Node.isObjectLiteralExpression(node)) {
		const result: Record<string, unknown> = {};
		for (const prop of node.getProperties()) {
			if (Node.isPropertyAssignment(prop)) {
				const key = prop.getName();
				const initializer = prop.getInitializer();
				if (initializer) {
					result[key] = extractObjectLiteralValue(initializer);
				}
			}
		}
		return result;
	}
	return null;
}

function parseObjectLiteralMetadata(objLiteral: Node): Record<string, unknown> {
	if (!Node.isObjectLiteralExpression(objLiteral)) return {};
	return extractObjectLiteralValue(objLiteral) as Record<string, unknown>;
}

function extractValidatorInfo(callExpr: CallExpression): ExtractedValidator | null {
	const expression = callExpr.getExpression();
	if (!Node.isIdentifier(expression) || expression.getText() !== 'Validator') {
		return null;
	}

	const args = callExpr.getArguments();
	if (args.length < 2) {
		return null;
	}

	const targetArg = args[0];
	const schemaArg = args[1];

	const target = extractStringLiteral(targetArg);
	if (!target || !isValidatorTarget(target)) {
		return null;
	}

	let schemaName: string | null = null;
	let inlineSchema: string | null = null;

	if (Node.isIdentifier(schemaArg)) {
		schemaName = schemaArg.getText();
	} else if (Node.isCallExpression(schemaArg)) {
		const callText = schemaArg.getText();
		if (callText.startsWith('z.object')) {
			inlineSchema = callText;
		} else {
			const callExpressionName = schemaArg.getExpression();
			if (Node.isPropertyAccessExpression(callExpressionName)) {
				const propName = callExpressionName.getName();
				if (propName === 'merge' || propName === 'pick' || propName === 'omit' || propName === 'partial') {
					const obj = callExpressionName.getExpression();
					if (Node.isIdentifier(obj)) {
						schemaName = obj.getText();
					} else {
						inlineSchema = callText;
					}
				} else {
					inlineSchema = callText;
				}
			} else {
				inlineSchema = callText;
			}
		}
	} else if (Node.isPropertyAccessExpression(schemaArg)) {
		schemaName = schemaArg.getText();
	} else {
		inlineSchema = schemaArg.getText();
	}

	return {target, schemaName, inlineSchema};
}

interface MiddlewareInfo {
	middlewareName: string;
	rateLimitConfig: string | null;
	responseSchemaName: string | null;
	hasNoContent: boolean;
	explicitSummary: string | null;
	explicitOperationId: string | null;
	explicitDescription: string | null;
	explicitStatusCodes: Array<number> | null;
	explicitSecurity: Array<string> | null;
	oauth2RequiredScopes: Array<string> | null;
	oauth2ScopeMode: 'all' | 'any' | null;
	oauth2BearerTokenRequired: boolean;
	explicitTags: Array<string> | null;
	explicitDeprecated: boolean;
	explicitExternalDocs: {url: string; description?: string} | null;
}

function extractMiddlewareInfo(callExpr: CallExpression): MiddlewareInfo | null {
	const expression = callExpr.getExpression();

	if (Node.isIdentifier(expression)) {
		const name = expression.getText();

		if (name === 'RateLimitMiddleware') {
			const args = callExpr.getArguments();
			if (args.length > 0) {
				const configArg = args[0];
				const configText = configArg.getText();
				return {
					middlewareName: name,
					rateLimitConfig: configText,
					responseSchemaName: null,
					hasNoContent: false,
					explicitSummary: null,
					explicitOperationId: null,
					explicitDescription: null,
					explicitStatusCodes: null,
					explicitSecurity: null,
					oauth2RequiredScopes: null,
					oauth2ScopeMode: null,
					oauth2BearerTokenRequired: false,
					explicitTags: null,
					explicitDeprecated: false,
					explicitExternalDocs: null,
				};
			}
		}

		if (name === 'ResponseType') {
			const args = callExpr.getArguments();
			if (args.length > 0) {
				const schemaArg = args[0];
				let schemaName: string | null = null;
				if (Node.isIdentifier(schemaArg)) {
					schemaName = schemaArg.getText();
				} else if (Node.isPropertyAccessExpression(schemaArg)) {
					schemaName = schemaArg.getText();
				} else if (Node.isCallExpression(schemaArg)) {
					schemaName = schemaArg.getText();
				}
				return {
					middlewareName: name,
					rateLimitConfig: null,
					responseSchemaName: schemaName,
					hasNoContent: false,
					explicitSummary: null,
					explicitOperationId: null,
					explicitDescription: null,
					explicitStatusCodes: null,
					explicitSecurity: null,
					oauth2RequiredScopes: null,
					oauth2ScopeMode: null,
					oauth2BearerTokenRequired: false,
					explicitTags: null,
					explicitDeprecated: false,
					explicitExternalDocs: null,
				};
			}
		}

		if (name === 'NoContent') {
			return {
				middlewareName: name,
				rateLimitConfig: null,
				responseSchemaName: null,
				hasNoContent: true,
				explicitSummary: null,
				explicitOperationId: null,
				explicitDescription: null,
				explicitStatusCodes: null,
				explicitSecurity: null,
				oauth2RequiredScopes: null,
				oauth2ScopeMode: null,
				oauth2BearerTokenRequired: false,
				explicitTags: null,
				explicitDeprecated: false,
				explicitExternalDocs: null,
			};
		}

		if (name === 'OpenAPI') {
			const args = callExpr.getArguments();
			if (args.length === 0) return null;

			const firstArg = args[0];

			if (Node.isObjectLiteralExpression(firstArg)) {
				const metadata = parseObjectLiteralMetadata(firstArg);
				const operationId = typeof metadata.operationId === 'string' ? metadata.operationId : null;
				const summary = typeof metadata.summary === 'string' ? metadata.summary : null;
				const description = typeof metadata.description === 'string' ? metadata.description : null;
				const deprecated = typeof metadata.deprecated === 'boolean' ? metadata.deprecated : false;

				let schemaName: string | null = null;
				if (metadata.responseSchema != null) {
					schemaName = String(metadata.responseSchema);
				}

				const statusCodes = extractNumberArray(metadata.statusCode);
				const security = extractStringArray(metadata.security);
				const tags = extractStringArray(metadata.tags);

				let externalDocs: {url: string; description?: string} | null = null;
				if (
					metadata.externalDocs &&
					typeof metadata.externalDocs === 'object' &&
					'url' in metadata.externalDocs &&
					typeof metadata.externalDocs.url === 'string'
				) {
					externalDocs = {
						url: metadata.externalDocs.url,
						description:
							'description' in metadata.externalDocs && typeof metadata.externalDocs.description === 'string'
								? metadata.externalDocs.description
								: undefined,
					};
				}

				return {
					middlewareName: name,
					rateLimitConfig: null,
					responseSchemaName: schemaName,
					hasNoContent: schemaName === null || schemaName === 'null',
					explicitSummary: summary,
					explicitOperationId: operationId,
					explicitDescription: description,
					explicitStatusCodes: statusCodes,
					explicitSecurity: security,
					oauth2RequiredScopes: null,
					oauth2ScopeMode: null,
					oauth2BearerTokenRequired: false,
					explicitTags: tags,
					explicitDeprecated: deprecated,
					explicitExternalDocs: externalDocs,
				};
			}

			if (args.length >= 2) {
				const secondArg = args[1];
				let operationId: string | null = null;
				let summary: string | null = null;
				let schemaName: string | null = null;
				let description: string | null = null;

				if (Node.isStringLiteral(firstArg) || Node.isNoSubstitutionTemplateLiteral(firstArg)) {
					operationId = firstArg.getLiteralValue();
				}

				if (Node.isStringLiteral(secondArg) || Node.isNoSubstitutionTemplateLiteral(secondArg)) {
					summary = secondArg.getLiteralValue();
				}

				if (args.length > 2) {
					const thirdArg = args[2];
					if (Node.isIdentifier(thirdArg)) {
						schemaName = thirdArg.getText();
					} else if (Node.isPropertyAccessExpression(thirdArg)) {
						schemaName = thirdArg.getText();
					} else if (Node.isCallExpression(thirdArg)) {
						schemaName = thirdArg.getText();
					}
				}

				if (args.length > 3) {
					const fourthArg = args[3];
					if (Node.isObjectLiteralExpression(fourthArg)) {
						const properties = fourthArg.getProperties();
						for (const prop of properties) {
							if (Node.isPropertyAssignment(prop)) {
								const propName = prop.getName();
								if (propName === 'description') {
									const initializer = prop.getInitializer();
									if (initializer) {
										description = extractStringLiteral(initializer);
									}
								}
							}
						}
					}
				}

				return {
					middlewareName: name,
					rateLimitConfig: null,
					responseSchemaName: schemaName,
					hasNoContent: schemaName === null || schemaName === 'null',
					explicitSummary: summary,
					explicitOperationId: operationId,
					explicitDescription: description,
					explicitStatusCodes: null,
					explicitSecurity: null,
					oauth2RequiredScopes: null,
					oauth2ScopeMode: null,
					oauth2BearerTokenRequired: false,
					explicitTags: null,
					explicitDeprecated: false,
					explicitExternalDocs: null,
				};
			}
		}

		if (name === 'requireOAuth2Scope' || name === 'requireOAuth2ScopeForBearer') {
			const scopes = extractOAuth2ScopeArgs(callExpr.getArguments());
			return {
				middlewareName: name,
				rateLimitConfig: null,
				responseSchemaName: null,
				hasNoContent: false,
				explicitSummary: null,
				explicitOperationId: null,
				explicitDescription: null,
				explicitStatusCodes: null,
				explicitSecurity: null,
				oauth2RequiredScopes: scopes,
				oauth2ScopeMode: 'all',
				oauth2BearerTokenRequired: false,
				explicitTags: null,
				explicitDeprecated: false,
				explicitExternalDocs: null,
			};
		}

		if (name === 'requireAnyOAuth2Scope' || name === 'requireAnyOAuth2ScopeForBearer') {
			const scopes = extractOAuth2ScopeArgs(callExpr.getArguments());
			return {
				middlewareName: name,
				rateLimitConfig: null,
				responseSchemaName: null,
				hasNoContent: false,
				explicitSummary: null,
				explicitOperationId: null,
				explicitDescription: null,
				explicitStatusCodes: null,
				explicitSecurity: null,
				oauth2RequiredScopes: scopes,
				oauth2ScopeMode: 'any',
				oauth2BearerTokenRequired: false,
				explicitTags: null,
				explicitDeprecated: false,
				explicitExternalDocs: null,
			};
		}

		if (name === 'requireOAuth2BearerToken') {
			return {
				middlewareName: name,
				rateLimitConfig: null,
				responseSchemaName: null,
				hasNoContent: false,
				explicitSummary: null,
				explicitOperationId: null,
				explicitDescription: null,
				explicitStatusCodes: null,
				explicitSecurity: null,
				oauth2RequiredScopes: null,
				oauth2ScopeMode: null,
				oauth2BearerTokenRequired: true,
				explicitTags: null,
				explicitDeprecated: false,
				explicitExternalDocs: null,
			};
		}

		return {
			middlewareName: name,
			rateLimitConfig: null,
			responseSchemaName: null,
			hasNoContent: false,
			explicitSummary: null,
			explicitOperationId: null,
			explicitDescription: null,
			explicitStatusCodes: null,
			explicitSecurity: null,
			oauth2RequiredScopes: null,
			oauth2ScopeMode: null,
			oauth2BearerTokenRequired: false,
			explicitTags: null,
			explicitDeprecated: false,
			explicitExternalDocs: null,
		};
	}

	return null;
}

function extractHandlerInfo(
	arg: Node,
): {handlerSource: string; responseMapperName: string | null; successStatusCodes: Array<number>} | null {
	if (!Node.isArrowFunction(arg) && !Node.isFunctionExpression(arg)) {
		return null;
	}

	const handlerSource = arg.getText();

	let responseMapperName: string | null = null;
	const mapperMatch = handlerSource.match(/\b(map\w+To\w+)\s*\(/);
	if (mapperMatch) {
		responseMapperName = mapperMatch[1];
	}

	const successStatusCodes = extractSuccessStatusCodes(arg);

	const truncatedSource =
		handlerSource.length > 2000 ? `${handlerSource.slice(0, 2000)}\n// ... truncated` : handlerSource;

	return {handlerSource: truncatedSource, responseMapperName, successStatusCodes};
}

function extractSuccessStatusCodes(handler: Node): Array<number> {
	const codes = new Set<number>();

	handler.forEachDescendant((node) => {
		if (!Node.isCallExpression(node)) return;

		const expression = node.getExpression();
		if (!Node.isPropertyAccessExpression(expression)) return;

		const target = expression.getExpression();
		if (!Node.isIdentifier(target) || target.getText() !== 'ctx') return;

		const method = expression.getName();
		if (method !== 'json' && method !== 'body' && method !== 'text') return;

		const args = node.getArguments();
		if (args.length < 2) return;

		const statusArg = args[1];
		if (!Node.isNumericLiteral(statusArg)) return;

		const parsed = Number.parseInt(statusArg.getText(), 10);
		if (!Number.isFinite(parsed)) return;
		if (parsed >= 200 && parsed <= 299) {
			codes.add(parsed);
		}
	});

	return Array.from(codes).sort((a, b) => a - b);
}

function extractRouteFromCall(callExpr: CallExpression, sourceFile: SourceFile): ExtractedRoute | null {
	const expression = callExpr.getExpression();
	if (!Node.isPropertyAccessExpression(expression)) {
		return null;
	}

	const method = expression.getName().toLowerCase();
	if (!isHttpMethod(method)) {
		return null;
	}

	const args = callExpr.getArguments();
	if (args.length < 2) {
		return null;
	}

	const pathArg = args[0];
	const path = extractStringLiteral(pathArg);
	if (!path) {
		return null;
	}

	const validators: Array<ExtractedValidator> = [];
	const middlewares: Array<string> = [];
	let hasLoginRequired = false;
	let hasDefaultUserOnly = false;
	let hasLoginRequiredAllowSuspicious = false;
	let hasSudoMode = false;
	let rateLimitConfig: string | null = null;
	let handlerSource: string | null = null;
	let responseMapperName: string | null = null;
	let responseSchemaName: string | null = null;
	let hasNoContent = false;
	let successStatusCodes: Array<number> = [];
	let explicitSummary: string | null = null;
	let explicitOperationId: string | null = null;
	let explicitDescription: string | null = null;
	let explicitStatusCodes: Array<number> | null = null;
	let explicitSecurity: Array<string> | null = null;
	let oauth2RequiredScopes: Array<string> | null = null;
	let oauth2ScopeMode: 'all' | 'any' | null = null;
	let oauth2BearerTokenRequired = false;
	let explicitTags: Array<string> | null = null;
	let explicitDeprecated = false;
	let explicitExternalDocs: {url: string; description?: string} | null = null;

	for (let i = 1; i < args.length; i++) {
		const arg = args[i];

		if (Node.isIdentifier(arg)) {
			const name = arg.getText();
			middlewares.push(name);

			if (name === 'LoginRequired') {
				hasLoginRequired = true;
			} else if (name === 'DefaultUserOnly') {
				hasDefaultUserOnly = true;
			} else if (name === 'LoginRequiredAllowSuspicious') {
				hasLoginRequiredAllowSuspicious = true;
			} else if (name === 'SudoModeMiddleware') {
				hasSudoMode = true;
			}
		} else if (Node.isCallExpression(arg)) {
			const validatorInfo = extractValidatorInfo(arg);
			if (validatorInfo) {
				validators.push(validatorInfo);
			} else {
				const middlewareInfo = extractMiddlewareInfo(arg);
				if (middlewareInfo) {
					middlewares.push(middlewareInfo.middlewareName);
					if (middlewareInfo.rateLimitConfig) {
						rateLimitConfig = middlewareInfo.rateLimitConfig;
					}
					if (middlewareInfo.responseSchemaName) {
						responseSchemaName = middlewareInfo.responseSchemaName;
					}
					if (middlewareInfo.hasNoContent) {
						hasNoContent = true;
					}
					if (middlewareInfo.explicitSummary) {
						explicitSummary = middlewareInfo.explicitSummary;
					}
					if (middlewareInfo.explicitOperationId) {
						explicitOperationId = middlewareInfo.explicitOperationId;
					}
					if (middlewareInfo.explicitDescription) {
						explicitDescription = middlewareInfo.explicitDescription;
					}
					if (middlewareInfo.explicitStatusCodes) {
						explicitStatusCodes = middlewareInfo.explicitStatusCodes;
					}
					if (middlewareInfo.explicitSecurity) {
						explicitSecurity = middlewareInfo.explicitSecurity;
					}
					if (middlewareInfo.oauth2RequiredScopes && middlewareInfo.oauth2ScopeMode) {
						if (oauth2ScopeMode && oauth2ScopeMode !== middlewareInfo.oauth2ScopeMode) {
							throw new Error(
								`Cannot combine OAuth2 scope middleware modes on ${method.toUpperCase()} ${path} in ${sourceFile.getFilePath()}:${callExpr.getStartLineNumber()}`,
							);
						}
						oauth2ScopeMode = middlewareInfo.oauth2ScopeMode;
						const combinedScopes: Array<string> = [
							...(oauth2RequiredScopes ?? []),
							...middlewareInfo.oauth2RequiredScopes,
						];
						oauth2RequiredScopes = Array.from(new Set<string>(combinedScopes));
					}
					if (middlewareInfo.oauth2BearerTokenRequired) {
						oauth2BearerTokenRequired = true;
					}
					if (middlewareInfo.explicitTags) {
						explicitTags = middlewareInfo.explicitTags;
					}
					if (middlewareInfo.explicitDeprecated) {
						explicitDeprecated = middlewareInfo.explicitDeprecated;
					}
					if (middlewareInfo.explicitExternalDocs) {
						explicitExternalDocs = middlewareInfo.explicitExternalDocs;
					}
				}
			}
		} else if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) {
			const handlerInfo = extractHandlerInfo(arg);
			if (handlerInfo) {
				handlerSource = handlerInfo.handlerSource;
				responseMapperName = handlerInfo.responseMapperName;
				successStatusCodes = handlerInfo.successStatusCodes;
			}
		}
	}

	return {
		method,
		path,
		controllerFile: sourceFile.getFilePath(),
		lineNumber: callExpr.getStartLineNumber(),
		validators,
		middlewares,
		hasLoginRequired,
		hasDefaultUserOnly,
		hasLoginRequiredAllowSuspicious,
		hasSudoMode,
		rateLimitConfig,
		handlerSource,
		responseMapperName,
		responseSchemaName,
		hasNoContent,
		successStatusCodes,
		explicitSummary,
		explicitOperationId,
		explicitDescription,
		explicitStatusCodes,
		explicitSecurity,
		oauth2RequiredScopes,
		oauth2ScopeMode,
		oauth2BearerTokenRequired,
		explicitTags,
		explicitDeprecated,
		explicitExternalDocs,
	};
}

function findRoutesInSourceFile(sourceFile: SourceFile): Array<ExtractedRoute> {
	const routes: Array<ExtractedRoute> = [];

	sourceFile.forEachDescendant((node) => {
		if (Node.isCallExpression(node)) {
			const route = extractRouteFromCall(node, sourceFile);
			if (route) {
				routes.push(route);
			}
		}
	});

	return routes;
}

export function extractRoutesFromControllers(controllerPaths: Array<string>): Array<ExtractedRoute> {
	const project = new Project({
		skipAddingFilesFromTsConfig: true,
		skipFileDependencyResolution: true,
	});

	const routes: Array<ExtractedRoute> = [];

	for (const controllerPath of controllerPaths) {
		try {
			const sourceFile = project.addSourceFileAtPath(controllerPath);
			const fileRoutes = findRoutesInSourceFile(sourceFile);
			routes.push(...fileRoutes);
		} catch (error) {
			console.warn(`Warning: Could not parse ${controllerPath}:`, error);
		}
	}

	return routes;
}

export function discoverControllerFiles(apiPackagePath: string): Array<string> {
	const project = new Project({
		tsConfigFilePath: `${apiPackagePath}/tsconfig.json`,
		skipAddingFilesFromTsConfig: true,
	});

	const sourceFiles = project.addSourceFilesAtPaths([`${apiPackagePath}/src/**/*Controller.tsx`]);

	return sourceFiles.map((sf) => sf.getFilePath());
}
