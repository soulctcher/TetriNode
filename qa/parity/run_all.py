from verify_contracts import run as verify_contracts
from verify_python_parity import run as verify_parity


def run():
    verify_contracts()
    verify_parity()
    print("all parity checks OK")


if __name__ == "__main__":
    run()
