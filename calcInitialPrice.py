from decimal import Decimal, getcontext
import math

# Set precision to avoid floating point errors
getcontext().prec = 100

# Calculate the price ratio (token1 / token0)
# 3,800 WGHO and 1,100,000 BONSAI
# Since BONSAI is token0 and WGHO is token1 (alphabetical order)
# We need token1/token0 = WGHO/BONSAI = 3800/1100000 = 0.003454545454545455
price = Decimal('3800') / Decimal('1100000')

# Calculate square root of price
sqrt_price = Decimal(str(math.sqrt(float(price))))

# Calculate 2^96
factor = Decimal(2) ** Decimal(96)

# Calculate sqrtPriceX96
sqrt_price_x96 = int(sqrt_price * factor)

print(f'sqrtPriceX96: {sqrt_price_x96}') 