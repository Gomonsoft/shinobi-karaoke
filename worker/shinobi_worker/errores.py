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
