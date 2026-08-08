import 'dotenv/config'
import { spawn } from 'node:child_process'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and add valid MySQL credentials.')
  process.exit(1)
}

const prismaExecutable = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
const prisma = spawn(
  prismaExecutable,
  ['db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'],
  {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    stdio: ['pipe', 'inherit', 'inherit'],
  },
)

prisma.stdin.end('SELECT 1;')

prisma.on('error', (error) => {
  console.error(`Unable to start Prisma: ${error.message}`)
  process.exit(1)
})

prisma.on('close', (code) => {
  if (code === 0) {
    console.log('MySQL connection successful.')
  }

  process.exit(code ?? 1)
})
