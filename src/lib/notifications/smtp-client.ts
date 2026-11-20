import net from "net";
import tls from "tls";
import { EmailDeliveryResult, EmailSendOptions } from "./types";

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean; // true for port 465 SSL/TLS, false for 587/25
  user?: string;
  pass?: string;
  from: string;
  timeoutMs?: number;
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.NOTIFICATION_SENDER_EMAIL || user || "website@image-developments.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);

  if (!host) {
    return null;
  }

  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    timeoutMs: parseInt(process.env.SMTP_TIMEOUT_MS || "15000", 10),
  };
}

class SmtpSocket {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = "";
  private resolveLine: ((line: string) => void) | null = null;
  private rejectLine: ((err: Error) => void) | null = null;

  constructor(socket: net.Socket | tls.TLSSocket) {
    this.socket = socket;
    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      this.processBuffer();
    });

    this.socket.on("error", (err) => {
      if (this.rejectLine) {
        this.rejectLine(err);
        this.rejectLine = null;
      }
    });

    this.socket.on("close", () => {
      if (this.rejectLine) {
        this.rejectLine(new Error("SMTP connection closed unexpectedly"));
        this.rejectLine = null;
      }
    });
  }

  private processBuffer() {
    while (true) {
      const idx = this.buffer.indexOf("\r\n");
      if (idx === -1) break;
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);

      // In SMTP multiline responses: "250-line1" then "250 line2" (space after code is final)
      if (line.length >= 4 && line[3] === "-") {
        continue; // wait for terminating code line
      }

      if (this.resolveLine) {
        const resolve = this.resolveLine;
        this.resolveLine = null;
        resolve(line);
      }
    }
  }

  public readResponse(timeoutMs = 15000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.rejectLine === reject) {
          this.rejectLine = null;
          reject(new Error(`SMTP timeout waiting for response after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.resolveLine = (line) => {
        clearTimeout(timer);
        resolve(line);
      };
      this.rejectLine = (err) => {
        clearTimeout(timer);
        reject(err);
      };

      this.processBuffer();
    });
  }

  public sendCommand(cmd: string): Promise<string> {
    this.socket.write(cmd + "\r\n");
    return this.readResponse();
  }

  public writeRaw(data: string) {
    this.socket.write(data);
  }

  public upgradeTls(options: tls.ConnectionOptions): Promise<SmtpSocket> {
    return new Promise((resolve, reject) => {
      this.socket.removeAllListeners("data");
      this.socket.removeAllListeners("error");
      this.socket.removeAllListeners("close");

      const tlsSocket = tls.connect({
        socket: this.socket,
        ...options,
      });

      tlsSocket.on("secureConnect", () => {
        resolve(new SmtpSocket(tlsSocket));
      });

      tlsSocket.on("error", (err) => {
        reject(err);
      });
    });
  }

  public close() {
    try {
      this.socket.end();
    } catch {
      // ignore
    }
  }
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

function buildMimeMessage(options: EmailSendOptions, from: string): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const lines: string[] = [
    `From: ${cleanHeader(options.from || from)}`,
    `To: ${cleanHeader(options.to)}`,
    ...(options.replyTo ? [`Reply-To: ${cleanHeader(options.replyTo)}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(cleanHeader(options.subject), "utf8").toString("base64")}?=`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    Buffer.from(options.text, "utf8").toString("base64"),
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    Buffer.from(options.html, "utf8").toString("base64"),
    "",
    `--${boundary}--`,
    "",
  ];

  return lines.join("\r\n");
}

export async function sendViaSmtp(options: EmailSendOptions, config: SmtpConfig): Promise<EmailDeliveryResult> {
  let activeSocket: SmtpSocket | null = null;

  try {
    const timeout = config.timeoutMs || 15000;

    if (config.secure) {
      const tlsSock = tls.connect({
        host: config.host,
        port: config.port,
        servername: config.host,
        rejectUnauthorized: true,
      });
      activeSocket = new SmtpSocket(tlsSock);
    } else {
      const netSock = net.connect({
        host: config.host,
        port: config.port,
      });
      activeSocket = new SmtpSocket(netSock);
    }

    const greeting = await activeSocket.readResponse(timeout);
    if (!greeting.startsWith("220")) {
      throw new Error(`Unexpected SMTP greeting: ${greeting}`);
    }

    // EHLO
    let ehloRes = await activeSocket.sendCommand(`EHLO ${config.host}`);
    if (!ehloRes.startsWith("250")) {
      ehloRes = await activeSocket.sendCommand(`HELO ${config.host}`);
      if (!ehloRes.startsWith("250")) {
        throw new Error(`HELO/EHLO rejected: ${ehloRes}`);
      }
    }

    // STARTTLS if not already secure and port is not 465
    if (!config.secure && (config.port === 587 || config.port === 25)) {
      const startTlsRes = await activeSocket.sendCommand("STARTTLS");
      if (startTlsRes.startsWith("220")) {
        activeSocket = await activeSocket.upgradeTls({
          host: config.host,
          servername: config.host,
          rejectUnauthorized: true,
        });

        // Re-issue EHLO after TLS upgrade
        const postTlsEhlo = await activeSocket.sendCommand(`EHLO ${config.host}`);
        if (!postTlsEhlo.startsWith("250")) {
          throw new Error(`EHLO failed after STARTTLS: ${postTlsEhlo}`);
        }
      }
    }

    // AUTH LOGIN if credentials provided
    if (config.user && config.pass) {
      const authRes = await activeSocket.sendCommand("AUTH LOGIN");
      if (!authRes.startsWith("334")) {
        throw new Error(`AUTH LOGIN rejected: ${authRes}`);
      }

      const userB64 = Buffer.from(config.user).toString("base64");
      const userRes = await activeSocket.sendCommand(userB64);
      if (!userRes.startsWith("334")) {
        throw new Error(`SMTP username rejected: ${userRes}`);
      }

      const passB64 = Buffer.from(config.pass).toString("base64");
      const passRes = await activeSocket.sendCommand(passB64);
      if (!passRes.startsWith("235")) {
        throw new Error(`SMTP authentication failed: ${passRes}`);
      }
    }

    // MAIL FROM
    const fromAddr = config.from.match(/<([^>]+)>/)?.[1] || config.from;
    const mailFromRes = await activeSocket.sendCommand(`MAIL FROM:<${fromAddr}>`);
    if (!mailFromRes.startsWith("250")) {
      throw new Error(`MAIL FROM rejected: ${mailFromRes}`);
    }

    // RCPT TO
    const toAddr = options.to.match(/<([^>]+)>/)?.[1] || options.to;
    const rcptToRes = await activeSocket.sendCommand(`RCPT TO:<${toAddr}>`);
    if (!rcptToRes.startsWith("250") && !rcptToRes.startsWith("251")) {
      throw new Error(`RCPT TO rejected: ${rcptToRes}`);
    }

    // DATA
    const dataRes = await activeSocket.sendCommand("DATA");
    if (!dataRes.startsWith("354")) {
      throw new Error(`DATA command rejected: ${dataRes}`);
    }

    // Write body ending with CRLF.CRLF
    const message = buildMimeMessage(options, config.from);
    // Dot-stuffing for SMTP lines starting with a dot
    const stuffed = message.replace(/\r\n\./g, "\r\n..");
    const endRes = await activeSocket.sendCommand(stuffed + "\r\n.");
    if (!endRes.startsWith("250")) {
      throw new Error(`DATA submission rejected: ${endRes}`);
    }

    // QUIT
    try {
      await activeSocket.sendCommand("QUIT");
    } catch {
      // ignore quit error
    }

    activeSocket.close();

    return {
      success: true,
      status: "ACCEPTED",
      messageId: `smtp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      provider: "smtp",
    };
  } catch (err: unknown) {
    if (activeSocket) {
      activeSocket.close();
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: "FAILED",
      error: message,
      provider: "smtp",
    };
  }
}

/**
 * Perform a socket-level test of SMTP connectivity, TLS handshake, and authentication
 * without sending an email message or submitting DATA.
 */
export async function testSmtpConnection(
  config: SmtpConfig
): Promise<{ success: boolean; message: string; greeting?: string }> {
  let activeSocket: SmtpSocket | null = null;

  try {
    const timeout = config.timeoutMs || 10000;

    if (config.secure) {
      const tlsSock = tls.connect({
        host: config.host,
        port: config.port,
        servername: config.host,
        rejectUnauthorized: true,
      });
      activeSocket = new SmtpSocket(tlsSock);
    } else {
      const netSock = net.connect({
        host: config.host,
        port: config.port,
      });
      activeSocket = new SmtpSocket(netSock);
    }

    const greeting = await activeSocket.readResponse(timeout);
    if (!greeting.startsWith("220")) {
      throw new Error(`Unexpected SMTP greeting: ${greeting}`);
    }

    let ehloRes = await activeSocket.sendCommand(`EHLO ${config.host}`);
    if (!ehloRes.startsWith("250")) {
      ehloRes = await activeSocket.sendCommand(`HELO ${config.host}`);
      if (!ehloRes.startsWith("250")) {
        throw new Error(`HELO/EHLO rejected: ${ehloRes}`);
      }
    }

    // STARTTLS if not already secure and port is 587/25
    if (!config.secure && (config.port === 587 || config.port === 25)) {
      const startTlsRes = await activeSocket.sendCommand("STARTTLS");
      if (startTlsRes.startsWith("220")) {
        activeSocket = await activeSocket.upgradeTls({
          host: config.host,
          servername: config.host,
          rejectUnauthorized: true,
        });

        const postTlsEhlo = await activeSocket.sendCommand(`EHLO ${config.host}`);
        if (!postTlsEhlo.startsWith("250")) {
          throw new Error(`EHLO failed after STARTTLS: ${postTlsEhlo}`);
        }
      }
    }

    // AUTH LOGIN if credentials provided
    if (config.user && config.pass) {
      const authRes = await activeSocket.sendCommand("AUTH LOGIN");
      if (!authRes.startsWith("334")) {
        throw new Error(`AUTH LOGIN rejected: ${authRes}`);
      }

      const userB64 = Buffer.from(config.user).toString("base64");
      const userRes = await activeSocket.sendCommand(userB64);
      if (!userRes.startsWith("334")) {
        throw new Error(`SMTP username rejected: ${userRes}`);
      }

      const passB64 = Buffer.from(config.pass).toString("base64");
      const passRes = await activeSocket.sendCommand(passB64);
      if (!passRes.startsWith("235")) {
        throw new Error(`SMTP authentication failed (invalid password or credentials): ${passRes}`);
      }
    }

    try {
      await activeSocket.sendCommand("QUIT");
    } catch {
      // ignore
    }
    activeSocket.close();

    return {
      success: true,
      message: `Successfully connected and authenticated with ${config.host}:${config.port} via ${config.secure ? "SSL/TLS" : "STARTTLS/plain"}.`,
      greeting,
    };
  } catch (err: unknown) {
    if (activeSocket) {
      activeSocket.close();
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `SMTP connection failed: ${message}`,
    };
  }
}


