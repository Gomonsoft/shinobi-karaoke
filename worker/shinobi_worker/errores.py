"""Excepciones del worker que se traducen a mensajes `error` del protocolo."""


class ErrorWorker(Exception):
    def __init__(self, codigo: str, mensaje: str, reintentable: bool = False) -> None:
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje
        self.reintentable = reintentable


class ArgumentosNoValidos(ErrorWorker):
    def __init__(self, mensaje: str) -> None:
        super().__init__("ARGUMENTOS_NO_VALIDOS", mensaje)


# Catálogo de códigos estables; debe coincidir con `app/src/shared/errores.ts`
# (lo comprueba un test de Vitest que lee este archivo).
CODIGOS_ERROR = (
    "SIN_CONEXION",
    "SIN_ESPACIO",
    "FORMATO_NO_SOPORTADO",
    "AUDIO_DEMASIADO_CORTO",
    "URL_NO_VALIDA",
    "URL_NO_SOPORTADA",
    "VIDEO_NO_DISPONIBLE",
    "YOUTUBE_BLOQUEADO",
    "MEMORIA_INSUFICIENTE",
    "MODELO_NO_DISPONIBLE",
    "LETRA_NO_ENCONTRADA",
    "INSTRUMENTAL",
    "SERVICIO_NO_DISPONIBLE",
    "ARGUMENTOS_NO_VALIDOS",
    "ERROR_INTERNO",
    "RUNTIME_NO_DISPONIBLE",
    "VERIFICACION_FALLIDA",
    "PLATAFORMA_NO_SOPORTADA",
    "CANCELADO",
    "DEMO_FALLO",
)
