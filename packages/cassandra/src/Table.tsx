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

import type {CassandraParams, CassandraValue, PreparedQuery} from '@fluxer/cassandra/src/CassandraTypes';

export type DbOp<T> = {kind: 'set'; value: T} | {kind: 'clear'};

export const Db = {
	set<T>(value: T): DbOp<T> {
		return {kind: 'set', value};
	},
	clear<T = never>(): DbOp<T> {
		return {kind: 'clear'};
	},
} as const;

export type ColumnName<Row> = Extract<keyof Row, string>;
type RowValue<Row, K extends ColumnName<Row>> = Row[K & keyof Row];

export type WhereExpr<Row extends object> =
	| {kind: 'eq'; col: ColumnName<Row>; param: string}
	| {kind: 'in'; col: ColumnName<Row>; param: string}
	| {kind: 'lt'; col: ColumnName<Row>; param: string}
	| {kind: 'gt'; col: ColumnName<Row>; param: string}
	| {kind: 'lte'; col: ColumnName<Row>; param: string}
	| {kind: 'gte'; col: ColumnName<Row>; param: string}
	| {kind: 'tokenGt'; col: ColumnName<Row>; param: string}
	| {kind: 'tupleGt'; cols: ReadonlyArray<ColumnName<Row>>; params: ReadonlyArray<string>};

export type OrderBy<Row extends object> = {col: ColumnName<Row>; direction?: 'ASC' | 'DESC' | undefined};

export interface QueryTemplate<P extends CassandraParams = CassandraParams> {
	cql: string;
	bind(params: P): PreparedQuery<P>;
}

export interface TableSelectOptions<Row extends object> {
	columns?: ReadonlyArray<ColumnName<Row>> | undefined;
	where?: WhereExpr<Row> | ReadonlyArray<WhereExpr<Row>> | undefined;
	orderBy?: OrderBy<Row> | undefined;
	limit?: number | undefined;
}

export interface TableDeleteOptions<Row extends object> {
	where?: WhereExpr<Row> | ReadonlyArray<WhereExpr<Row>> | undefined;
}

export interface TableCountOptions<Row extends object> {
	where?: WhereExpr<Row> | ReadonlyArray<WhereExpr<Row>> | undefined;
}

export interface TableDefinition<Row extends object, PK extends ColumnName<Row>, PartKey extends ColumnName<Row> = PK> {
	name: string;
	columns: ReadonlyArray<ColumnName<Row>>;
	primaryKey: ReadonlyArray<PK>;
	partitionKey?: ReadonlyArray<PartKey> | undefined;
}

export type TablePatch<Row extends object, PK extends ColumnName<Row>> = Partial<{
	[K in Exclude<ColumnName<Row>, PK>]: DbOp<RowValue<Row, K>>;
}>;

export interface Table<Row extends object, PK extends ColumnName<Row>, PartKey extends ColumnName<Row> = PK> {
	name: string;
	columns: ReadonlyArray<ColumnName<Row>>;
	primaryKey: ReadonlyArray<PK>;
	partitionKey: ReadonlyArray<PartKey>;
	selectCql(opts?: TableSelectOptions<Row>): string;
	select(opts?: TableSelectOptions<Row>): QueryTemplate;
	updateAllCql(): string;
	paramsFromRow(row: Row): CassandraParams;
	upsertAll(row: Row): PreparedQuery;
	patchByPk(pk: Pick<Row, PK>, patch: TablePatch<Row, PK>): PreparedQuery;
	deleteCql(opts?: TableDeleteOptions<Row>): string;
	delete(opts?: TableDeleteOptions<Row>): QueryTemplate;
	deleteByPk(pk: Pick<Row, PK>): PreparedQuery;
	deletePartition(pk: Pick<Row, PartKey>): PreparedQuery;
	insertCql(opts?: {ttlParam?: string | undefined}): string;
	insert(row: Row): PreparedQuery;
	insertWithTtl(row: Row, ttlSeconds: number): PreparedQuery;
	insertWithTtlParam(row: Row, ttlParamName: string): PreparedQuery;
	insertIfNotExists(row: Row): PreparedQuery;
	selectCountCql(opts?: TableCountOptions<Row>): string;
	selectCount(opts?: TableCountOptions<Row>): QueryTemplate;
	insertWithNow<NowCol extends ColumnName<Row>>(row: Omit<Row, NowCol>, nowColumn: NowCol): PreparedQuery;
	patchByPkWithTtl(pk: Pick<Row, PK>, patch: TablePatch<Row, PK>, ttlSeconds: number): PreparedQuery;
	patchByPkWithTtlParam(
		pk: Pick<Row, PK>,
		patch: TablePatch<Row, PK>,
		ttlParamName: string,
		ttlValue: number,
	): PreparedQuery;
	upsertAllWithTtl(row: Row, ttlSeconds: number): PreparedQuery;
	upsertAllWithTtlParam(row: Row, ttlParamName: string, ttlValue: number): PreparedQuery;
	patchByPkIf<CondCol extends Exclude<ColumnName<Row>, PK>>(
		pk: Pick<Row, PK>,
		patch: TablePatch<Row, PK>,
		condition: {col: CondCol; expectedParam: string; expectedValue: RowValue<Row, CondCol>},
	): PreparedQuery;
	where: {
		eq: <K extends ColumnName<Row>>(col: K, param?: string) => WhereExpr<Row>;
		in: <K extends ColumnName<Row>>(col: K, param: string) => WhereExpr<Row>;
		lt: <K extends ColumnName<Row>>(col: K, param?: string) => WhereExpr<Row>;
		gt: <K extends ColumnName<Row>>(col: K, param?: string) => WhereExpr<Row>;
		lte: <K extends ColumnName<Row>>(col: K, param?: string) => WhereExpr<Row>;
		gte: <K extends ColumnName<Row>>(col: K, param?: string) => WhereExpr<Row>;
		tokenGt: <K extends ColumnName<Row>>(col: K, param: string) => WhereExpr<Row>;
		tupleGt: <K extends ColumnName<Row>>(cols: ReadonlyArray<K>, params: ReadonlyArray<string>) => WhereExpr<Row>;
	};
}

function prepared<P extends CassandraParams>(cql: string, params: P): PreparedQuery<P> {
	return {cql, params};
}

function asWhereArray<Row extends object>(
	where: WhereExpr<Row> | ReadonlyArray<WhereExpr<Row>> | undefined,
): Array<WhereExpr<Row>> {
	if (where === undefined) {
		return [];
	}

	if (Array.isArray(where)) {
		return [...where];
	}

	return [where as WhereExpr<Row>];
}

function compileWhere<Row extends object>(where: WhereExpr<Row>): string {
	switch (where.kind) {
		case 'eq':
			return `${where.col} = :${where.param}`;
		case 'in':
			return `${where.col} IN :${where.param}`;
		case 'lt':
			return `${where.col} < :${where.param}`;
		case 'gt':
			return `${where.col} > :${where.param}`;
		case 'lte':
			return `${where.col} <= :${where.param}`;
		case 'gte':
			return `${where.col} >= :${where.param}`;
		case 'tokenGt':
			return `TOKEN(${where.col}) > TOKEN(:${where.param})`;
		case 'tupleGt': {
			if (where.cols.length === 0 || where.cols.length !== where.params.length) {
				throw new Error('tupleGt requires equal-length, non-empty cols and params.');
			}

			const cols = `(${where.cols.join(', ')})`;
			const params = `(${where.params.map((paramName) => `:${paramName}`).join(', ')})`;
			return `${cols} > ${params}`;
		}
		default: {
			const exhaustive: never = where;
			return exhaustive;
		}
	}
}

function compileWhereClause<Row extends object>(
	where: WhereExpr<Row> | ReadonlyArray<WhereExpr<Row>> | undefined,
): string {
	const clauses = asWhereArray(where);
	if (clauses.length === 0) {
		return '';
	}

	return ` WHERE ${clauses.map((clause) => compileWhere(clause)).join(' AND ')}`;
}

function toCassandraValue(op: DbOp<unknown>, tableName: string, columnName: string): CassandraValue {
	if (op.kind === 'clear') {
		return null;
	}

	if (op.value === undefined) {
		throw new Error(`Patch value for "${tableName}.${columnName}" is undefined. Use Db.clear() to write null.`);
	}

	return op.value as CassandraValue;
}

function ensureUnique(values: ReadonlyArray<string>, fieldName: string, tableName: string): void {
	const seen = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) {
			throw new Error(`Table "${tableName}" contains duplicate ${fieldName} value "${value}".`);
		}
		seen.add(value);
	}
}

function assertValidTableDefinition<Row extends object, PK extends ColumnName<Row>, PartKey extends ColumnName<Row>>(
	definition: TableDefinition<Row, PK, PartKey>,
): void {
	const tableName = definition.name;
	if (definition.columns.length === 0) {
		throw new Error(`Table "${tableName}" must define at least one column.`);
	}
	if (definition.primaryKey.length === 0) {
		throw new Error(`Table "${tableName}" must define at least one primary key column.`);
	}

	const columns = [...definition.columns] as Array<string>;
	const primaryKey = [...definition.primaryKey] as Array<string>;
	const partitionKey = [...(definition.partitionKey ?? definition.primaryKey)] as Array<string>;

	ensureUnique(columns, 'column', tableName);
	ensureUnique(primaryKey, 'primary key', tableName);
	ensureUnique(partitionKey, 'partition key', tableName);

	const columnSet = new Set<string>(columns);
	for (const keyColumn of primaryKey) {
		if (!columnSet.has(keyColumn)) {
			throw new Error(`Primary key column "${tableName}.${keyColumn}" must exist in table columns.`);
		}
	}

	const primaryKeySet = new Set<string>(primaryKey);
	for (const partitionColumn of partitionKey) {
		if (!columnSet.has(partitionColumn)) {
			throw new Error(`Partition key column "${tableName}.${partitionColumn}" must exist in table columns.`);
		}
		if (!primaryKeySet.has(partitionColumn)) {
			throw new Error(`Partition key column "${tableName}.${partitionColumn}" must also be part of the primary key.`);
		}
	}
}

interface PatchCqlOptions<Row extends object> {
	ttlSeconds?: number | undefined;
	ttlParamName?: string | undefined;
	condition?: {col: ColumnName<Row>; expectedParam: string} | undefined;
}

class CassandraTable<Row extends object, PK extends ColumnName<Row>, PartKey extends ColumnName<Row> = PK>
	implements Table<Row, PK, PartKey>
{
	public readonly name: string;
	public readonly columns: ReadonlyArray<ColumnName<Row>>;
	public readonly primaryKey: ReadonlyArray<PK>;
	public readonly partitionKey: ReadonlyArray<PartKey>;
	public readonly where: Table<Row, PK, PartKey>['where'];
	private readonly nonPrimaryKeyColumns: Array<Exclude<ColumnName<Row>, PK>>;
	private readonly updateAllStatement: string;
	private readonly deleteByPrimaryKeyStatement: string;
	private readonly insertBaseStatement: string;

	public constructor(definition: TableDefinition<Row, PK, PartKey>) {
		assertValidTableDefinition(definition);

		this.name = definition.name;
		this.columns = [...definition.columns];
		this.primaryKey = [...definition.primaryKey];
		this.partitionKey = definition.partitionKey
			? [...definition.partitionKey]
			: ([...definition.primaryKey] as unknown as Array<PartKey>);

		this.nonPrimaryKeyColumns = this.columns.filter((column) => {
			return !this.primaryKey.includes(column as PK);
		}) as Array<Exclude<ColumnName<Row>, PK>>;
		this.updateAllStatement = this.buildUpdateAllStatement();
		this.deleteByPrimaryKeyStatement = `DELETE FROM ${this.name} WHERE ${this.primaryKeyWhereClause()}`;
		this.insertBaseStatement = `INSERT INTO ${this.name} (${this.columns.join(', ')}) VALUES (${this.columns.map((column) => `:${column}`).join(', ')})`;

		this.where = {
			eq<K extends ColumnName<Row>>(col: K, param?: string): WhereExpr<Row> {
				return {kind: 'eq', col, param: param ?? col};
			},
			in<K extends ColumnName<Row>>(col: K, param: string): WhereExpr<Row> {
				return {kind: 'in', col, param};
			},
			lt<K extends ColumnName<Row>>(col: K, param?: string): WhereExpr<Row> {
				return {kind: 'lt', col, param: param ?? col};
			},
			gt<K extends ColumnName<Row>>(col: K, param?: string): WhereExpr<Row> {
				return {kind: 'gt', col, param: param ?? col};
			},
			lte<K extends ColumnName<Row>>(col: K, param?: string): WhereExpr<Row> {
				return {kind: 'lte', col, param: param ?? col};
			},
			gte<K extends ColumnName<Row>>(col: K, param?: string): WhereExpr<Row> {
				return {kind: 'gte', col, param: param ?? col};
			},
			tokenGt<K extends ColumnName<Row>>(col: K, param: string): WhereExpr<Row> {
				return {kind: 'tokenGt', col, param};
			},
			tupleGt<K extends ColumnName<Row>>(cols: ReadonlyArray<K>, params: ReadonlyArray<string>): WhereExpr<Row> {
				return {kind: 'tupleGt', cols, params};
			},
		};
	}

	public selectCql(options: TableSelectOptions<Row> = {}): string {
		const selectedColumns = (options.columns ?? this.columns).join(', ');
		const whereClause = compileWhereClause(options.where);
		const orderByClause = options.orderBy
			? ` ORDER BY ${options.orderBy.col} ${options.orderBy.direction ?? 'ASC'}`
			: '';
		const limitClause = this.limitClause(options.limit);
		return `SELECT ${selectedColumns} FROM ${this.name}${whereClause}${orderByClause}${limitClause}`;
	}

	public select(options: TableSelectOptions<Row> = {}): QueryTemplate {
		const cql = this.selectCql(options);
		return this.toTemplate(cql);
	}

	public updateAllCql(): string {
		return this.updateAllStatement;
	}

	public paramsFromRow(row: Row): CassandraParams {
		return this.collectRowParams(row, true);
	}

	public upsertAll(row: Row): PreparedQuery {
		if (this.hasAllColumns(row)) {
			return prepared(this.updateAllStatement, this.collectRowParams(row, true));
		}

		return this.buildDynamicUpsert(row);
	}

	public patchByPk(pk: Pick<Row, PK>, patch: TablePatch<Row, PK>): PreparedQuery {
		const patchColumns = this.patchColumns(patch, 'PATCH update');
		const cql = this.buildPatchStatement(patchColumns);
		const params = this.primaryKeyParams(pk);
		this.appendPatchParams(params, patch, patchColumns);
		return prepared(cql, params);
	}

	public deleteCql(options: TableDeleteOptions<Row> = {}): string {
		const whereClause = options.where ? compileWhereClause(options.where) : ` WHERE ${this.primaryKeyWhereClause()}`;
		return `DELETE FROM ${this.name}${whereClause}`;
	}

	public delete(options: TableDeleteOptions<Row> = {}): QueryTemplate {
		const cql = this.deleteCql(options);
		return this.toTemplate(cql);
	}

	public deleteByPk(pk: Pick<Row, PK>): PreparedQuery {
		return prepared(this.deleteByPrimaryKeyStatement, this.primaryKeyParams(pk));
	}

	public deletePartition(pk: Pick<Row, PartKey>): PreparedQuery {
		if (this.partitionKey.length === 0) {
			throw new Error(`Table "${this.name}" has no partition key columns.`);
		}

		const cql = `DELETE FROM ${this.name} WHERE ${this.partitionKeyWhereClause()}`;
		return prepared(cql, this.partitionKeyParams(pk));
	}

	public insertCql(options: {ttlParam?: string | undefined} = {}): string {
		if (!options.ttlParam) {
			return this.insertBaseStatement;
		}

		return `${this.insertBaseStatement} USING TTL :${options.ttlParam}`;
	}

	public insert(row: Row): PreparedQuery {
		return prepared(this.insertBaseStatement, this.collectRowParams(row, true));
	}

	public insertWithTtl(row: Row, ttlSeconds: number): PreparedQuery {
		const cql = `${this.insertBaseStatement} USING TTL ${ttlSeconds}`;
		return prepared(cql, this.collectRowParams(row, true));
	}

	public insertWithTtlParam(row: Row, ttlParamName: string): PreparedQuery {
		const cql = `${this.insertBaseStatement} USING TTL :${ttlParamName}`;
		const params = this.collectRowParams(row, true);
		const rowRecord = row as Record<string, unknown>;
		const ttlValue = rowRecord[ttlParamName];
		if (ttlValue === undefined) {
			throw new Error(
				`Row is missing TTL param value "${this.name}.${ttlParamName}". Include this field or use insertWithTtl().`,
			);
		}
		params[ttlParamName] = ttlValue as CassandraValue;
		return prepared(cql, params);
	}

	public insertIfNotExists(row: Row): PreparedQuery {
		const cql = `${this.insertBaseStatement} IF NOT EXISTS`;
		return prepared(cql, this.collectRowParams(row, true));
	}

	public selectCountCql(options: TableCountOptions<Row> = {}): string {
		const whereClause = compileWhereClause(options.where);
		return `SELECT COUNT(*) as count FROM ${this.name}${whereClause}`;
	}

	public selectCount(options: TableCountOptions<Row> = {}): QueryTemplate {
		const cql = this.selectCountCql(options);
		return this.toTemplate(cql);
	}

	public insertWithNow<NowCol extends ColumnName<Row>>(row: Omit<Row, NowCol>, nowColumn: NowCol): PreparedQuery {
		if (!this.columns.includes(nowColumn)) {
			throw new Error(`Column "${this.name}.${nowColumn}" does not exist.`);
		}

		const columns = this.columns.filter((column) => {
			return column !== nowColumn;
		});
		const cql = `INSERT INTO ${this.name} (${[...columns, nowColumn].join(', ')}) VALUES (${columns.map((column) => `:${column}`).join(', ')}, now())`;
		const rowRecord = row as Record<string, unknown>;
		const params: CassandraParams = {};
		for (const column of columns) {
			const value = rowRecord[column];
			if (value === undefined) {
				throw new Error(`Row is missing value for "${this.name}.${column}". INSERT requires all non-now columns.`);
			}
			params[column] = value as CassandraValue;
		}
		return prepared(cql, params);
	}

	public patchByPkWithTtl(pk: Pick<Row, PK>, patch: TablePatch<Row, PK>, ttlSeconds: number): PreparedQuery {
		const patchColumns = this.patchColumns(patch, 'PATCH update');
		const cql = this.buildPatchStatement(patchColumns, {ttlSeconds});
		const params = this.primaryKeyParams(pk);
		this.appendPatchParams(params, patch, patchColumns);
		return prepared(cql, params);
	}

	public patchByPkWithTtlParam(
		pk: Pick<Row, PK>,
		patch: TablePatch<Row, PK>,
		ttlParamName: string,
		ttlValue: number,
	): PreparedQuery {
		const patchColumns = this.patchColumns(patch, 'PATCH update');
		const cql = this.buildPatchStatement(patchColumns, {ttlParamName});
		const params = this.primaryKeyParams(pk);
		this.appendPatchParams(params, patch, patchColumns);
		params[ttlParamName] = ttlValue;
		return prepared(cql, params);
	}

	public upsertAllWithTtl(row: Row, ttlSeconds: number): PreparedQuery {
		const cql = this.nonPrimaryKeyColumns.length
			? `UPDATE ${this.name} USING TTL ${ttlSeconds} SET ${this.nonPrimaryKeyColumns.map((column) => `${column} = :${column}`).join(', ')} WHERE ${this.primaryKeyWhereClause()}`
			: `${this.insertBaseStatement} USING TTL ${ttlSeconds}`;
		return prepared(cql, this.collectRowParams(row, true));
	}

	public upsertAllWithTtlParam(row: Row, ttlParamName: string, ttlValue: number): PreparedQuery {
		const cql = this.nonPrimaryKeyColumns.length
			? `UPDATE ${this.name} USING TTL :${ttlParamName} SET ${this.nonPrimaryKeyColumns.map((column) => `${column} = :${column}`).join(', ')} WHERE ${this.primaryKeyWhereClause()}`
			: `${this.insertBaseStatement} USING TTL :${ttlParamName}`;
		const params = this.collectRowParams(row, true);
		params[ttlParamName] = ttlValue;
		return prepared(cql, params);
	}

	public patchByPkIf<CondCol extends Exclude<ColumnName<Row>, PK>>(
		pk: Pick<Row, PK>,
		patch: TablePatch<Row, PK>,
		condition: {col: CondCol; expectedParam: string; expectedValue: RowValue<Row, CondCol>},
	): PreparedQuery {
		const patchColumns = this.patchColumns(patch, 'conditional PATCH update');
		const cql = this.buildPatchStatement(patchColumns, {
			condition: {
				col: condition.col,
				expectedParam: condition.expectedParam,
			},
		});
		const params = this.primaryKeyParams(pk);
		this.appendPatchParams(params, patch, patchColumns);
		params[condition.expectedParam] = condition.expectedValue as CassandraValue;
		return prepared(cql, params);
	}

	private toTemplate(cql: string): QueryTemplate {
		return {
			cql,
			bind<P extends CassandraParams>(params: P): PreparedQuery<P> {
				return prepared(cql, params);
			},
		};
	}

	private buildUpdateAllStatement(): string {
		if (this.nonPrimaryKeyColumns.length === 0) {
			return this.insertBaseStatement;
		}

		const setClause = this.nonPrimaryKeyColumns.map((column) => `${column} = :${column}`).join(', ');
		return `UPDATE ${this.name} SET ${setClause} WHERE ${this.primaryKeyWhereClause()}`;
	}

	private collectRowParams(row: Row, requireAllColumns: boolean): CassandraParams {
		const rowRecord = row as Record<string, unknown>;
		const params: CassandraParams = {};
		for (const column of this.columns) {
			const value = rowRecord[column];
			if (value === undefined) {
				if (requireAllColumns) {
					throw new Error(
						`Row is missing value for "${this.name}.${column}". Full-row operations require every column to be present.`,
					);
				}
				continue;
			}
			params[column] = value as CassandraValue;
		}
		return params;
	}

	private hasAllColumns(row: Row): boolean {
		const rowRecord = row as Record<string, unknown>;
		for (const column of this.columns) {
			if (rowRecord[column] === undefined) {
				return false;
			}
		}
		return true;
	}

	private buildDynamicUpsert(row: Row): PreparedQuery {
		const rowRecord = row as Record<string, unknown>;
		const params: CassandraParams = {};
		const presentColumns: Array<ColumnName<Row>> = [];

		for (const column of this.columns) {
			const value = rowRecord[column];
			if (value === undefined) {
				continue;
			}
			presentColumns.push(column);
			params[column] = value as CassandraValue;
		}

		for (const keyColumn of this.primaryKey) {
			if (params[keyColumn] === undefined) {
				throw new Error(
					`Row is missing value for "${this.name}.${keyColumn}". Dynamic upserts require all primary key columns to be present.`,
				);
			}
		}

		const mutableColumns = presentColumns.filter((column) => {
			return !this.primaryKey.includes(column as PK);
		});

		const cql = mutableColumns.length
			? `UPDATE ${this.name} SET ${mutableColumns.map((column) => `${column} = :${column}`).join(', ')} WHERE ${this.primaryKeyWhereClause()}`
			: `INSERT INTO ${this.name} (${this.primaryKey.join(', ')}) VALUES (${this.primaryKey.map((column) => `:${column}`).join(', ')})`;
		return prepared(cql, params);
	}

	private patchColumns(patch: TablePatch<Row, PK>, actionName: string): Array<Exclude<ColumnName<Row>, PK>> {
		const columns = Object.keys(patch) as Array<Exclude<ColumnName<Row>, PK>>;
		if (columns.length === 0) {
			throw new Error(`Refusing to execute empty ${actionName} on table "${this.name}".`);
		}

		columns.sort((left, right) => {
			return this.columns.indexOf(left) - this.columns.indexOf(right);
		});
		return columns;
	}

	private buildPatchStatement(
		patchColumns: Array<Exclude<ColumnName<Row>, PK>>,
		options: PatchCqlOptions<Row> = {},
	): string {
		const setClause = patchColumns.map((column) => `${column} = :${column}`).join(', ');
		const ttlClause =
			options.ttlSeconds !== undefined
				? ` USING TTL ${options.ttlSeconds}`
				: options.ttlParamName
					? ` USING TTL :${options.ttlParamName}`
					: '';
		const conditionClause = options.condition
			? ` IF ${options.condition.col} = :${options.condition.expectedParam}`
			: '';
		return `UPDATE ${this.name}${ttlClause} SET ${setClause} WHERE ${this.primaryKeyWhereClause()}${conditionClause}`;
	}

	private appendPatchParams(
		params: CassandraParams,
		patch: TablePatch<Row, PK>,
		patchColumns: Array<Exclude<ColumnName<Row>, PK>>,
	): void {
		for (const column of patchColumns) {
			const op = patch[column];
			if (!op) {
				throw new Error(`Patch operation for "${this.name}.${column}" is missing.`);
			}
			params[column] = toCassandraValue(op, this.name, column);
		}
	}

	private primaryKeyParams(pk: Pick<Row, PK>): CassandraParams {
		const record = pk as Record<string, unknown>;
		const params: CassandraParams = {};
		for (const keyColumn of this.primaryKey) {
			const value = record[keyColumn];
			if (value === undefined) {
				throw new Error(`Primary key value is missing for "${this.name}.${keyColumn}".`);
			}
			params[keyColumn] = value as CassandraValue;
		}
		return params;
	}

	private partitionKeyParams(pk: Pick<Row, PartKey>): CassandraParams {
		const record = pk as Record<string, unknown>;
		const params: CassandraParams = {};
		for (const keyColumn of this.partitionKey) {
			const value = record[keyColumn];
			if (value === undefined) {
				throw new Error(`Partition key value is missing for "${this.name}.${keyColumn}".`);
			}
			params[keyColumn] = value as CassandraValue;
		}
		return params;
	}

	private primaryKeyWhereClause(): string {
		return this.primaryKey.map((column) => `${column} = :${column}`).join(' AND ');
	}

	private partitionKeyWhereClause(): string {
		return this.partitionKey.map((column) => `${column} = :${column}`).join(' AND ');
	}

	private limitClause(limit: number | undefined): string {
		if (limit === undefined) {
			return '';
		}
		if (!Number.isInteger(limit) || limit <= 0) {
			throw new Error(`SELECT limit for "${this.name}" must be a positive integer.`);
		}
		return ` LIMIT ${limit}`;
	}
}

export function defineTable<Row extends object, PK extends ColumnName<Row>, PartKey extends ColumnName<Row> = PK>(
	definition: TableDefinition<Row, PK, PartKey>,
): Table<Row, PK, PartKey> {
	return new CassandraTable(definition);
}
