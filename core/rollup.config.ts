
import { RollupOptions } from "rollup";
import dts from 'rollup-plugin-dts';
import typescript from '@rollup/plugin-typescript';
import del from 'rollup-plugin-delete';
import alias from '@rollup/plugin-alias';
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = [
    {
        plugins: [
            del({ targets: 'dist/*' }),
            typescript(),
        ],
        external: false,
        input: 'src/main.ts',
        output: {
            name: 'dlab.core',
            file: 'dist/index.js',
            format: 'es',
        },
    },
    {
        plugins: [
            alias({
                entries: [
                    { find: /@\/(.*)$/, replacement: path.resolve(__dirname, 'dist/typings/src', '$1') },
                ]
            }),
            dts(),
            del({ targets: 'dist/typings', hook: 'buildEnd' })
        ],
        input: 'dist/typings/src/main.d.ts',
        output: {
            format: 'es',
            file: 'dist/index.d.ts',
        },
    },
] as RollupOptions;
export default config;
