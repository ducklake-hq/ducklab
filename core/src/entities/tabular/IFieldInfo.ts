

export interface IFieldInfo {
    name: string;
    type: 'number' | 'string' | 'boolean' | 'datetime' | 'datetime_tz';
    nativeType?: any;
    default?: any;
    maxSize?: number;
}
